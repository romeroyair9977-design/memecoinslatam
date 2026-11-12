import 'server-only';
import { cacheSafeAddress } from '../addresses';
import { CALL_DAYS, MAX_CALL_AGE_MS, MAX_CALL_TOP10, MIN_CALL_BUY_SHARE, MIN_CALL_FOMO, MIN_CALL_LIQ, callTiers, type Multiple } from '../potential';
import { createAdminSupabase } from '../supabase/server';
import { getCandles } from './chart';
import { getFomoBoard } from './fomo';
import { getLivePrices } from './live';
import { toCall } from './potencial-map';
import { getRugCheckOverview } from './rugcheck';

export interface PotencialResult {
  ok: boolean;
  reason?: string;
  created: number;
  openBefore: number;
  hit: number;
  missed: number;
}

const DAY = 86_400_000;
const TIME_BUDGET_MS = 7_000;
const MAX_NEW_TOKENS = 3; // freno anti-spam: pocos llamados, bien escogidos
const MAX_RUGCHECKS = 4;
const MAX_CANDLE_CHECKS = 4;
const MAX_OPEN_TOTAL = 60;
const DEAD_LIQUIDITY = 1_000;

/**
 * Llamados v2.
 * 1) Publica llamados nuevos a partir del ranking de FOMO: moneda nueva (≤ 72 h), liquidez ≥ 8 K, FOMO ≥ 55, mayoría de
 *    compras y, en Solana, SIN mint ni freeze activos y con top 10 ≤ 60 % (si no se puede verificar, no se publica).
 * 2) Revisa los abiertos: precio actual y, para los menos revisados, las velas de 1 h (así un pico entre revisiones no se pierde).
 */
export async function runPotencial(): Promise<PotencialResult> {
  const empty = (reason: string): PotencialResult => ({ ok: false, reason, created: 0, openBefore: 0, hit: 0, missed: 0 });
  const admin = createAdminSupabase();
  if (!admin) return empty('missing_service_role');
  const deadline = Date.now() + TIME_BUDGET_MS;

  const { data: openRows, error } = await admin.from('veltrix_calls').select('*').eq('status', 'open');
  if (error) return empty('db');
  const open = ((openRows ?? []) as Record<string, unknown>[]).map(toCall);

  // ── 1) llamados nuevos ──
  let created = 0;
  if (open.length < MAX_OPEN_TOTAL) {
    const board = await getFomoBoard();
    const now = Date.now();
    const openKeys = new Set(open.map((c) => `${c.chain}:${cacheSafeAddress(c.address)}:${c.multiple}`));
    const eligible = board.items
      .filter((i) =>
        i.chain === 'solana' && i.priceUsd > 0 && i.liquidityUsd >= MIN_CALL_LIQ && i.fomo >= MIN_CALL_FOMO && i.buyShare5 >= MIN_CALL_BUY_SHARE &&
        i.pairCreatedAt !== null && now - i.pairCreatedAt <= MAX_CALL_AGE_MS && callTiers(i.marketCap).length > 0)
      .slice(0, 12);

    const inserts: Record<string, unknown>[] = [];
    let tokens = 0;
    let checks = 0;
    for (const it of eligible) {
      if (tokens >= MAX_NEW_TOKENS || checks >= MAX_RUGCHECKS || deadline - Date.now() < 3_000) break;
      const tiers = callTiers(it.marketCap).filter((m) => !openKeys.has(`${it.chain}:${cacheSafeAddress(it.address)}:${m}`));
      if (tiers.length === 0) continue;
      checks++;
      const ov = await getRugCheckOverview(it.address);
      // Sin datos de seguridad confiables NO se publica: las monedas pequeñas son las que más se rugean.
      if (!ov || ov.security.rugged || ov.security.mintAuthorityActive || ov.security.freezeAuthorityActive) continue;
      const top10 = ov.holders.top10Pct ?? 100;
      if (top10 > MAX_CALL_TOP10) continue;
      tokens++;
      const reasons = [
        `FOMO ${it.fomo}/100 (${it.state})`,
        `${it.buysPerMin.toFixed(1)} compras por minuto`,
        `${Math.round(it.buyShare5 * 100)}% compras en los últimos 5 min`,
        'Sin mint ni freeze activos',
        `Top 10 controla ${top10.toFixed(0)}%`,
      ];
      for (const m of tiers) {
        inserts.push({
          token_key: `${it.chain}:${cacheSafeAddress(it.address)}`,
          chain: it.chain,
          address: it.address,
          pair_address: it.pairAddress,
          symbol: it.symbol,
          name: it.name,
          image: it.imageUrl,
          multiple: m,
          entry_price: it.priceUsd,
          entry_mc: it.marketCap,
          target_mc: it.marketCap * m,
          score: it.fomo,
          reasons,
          expires_at: new Date(now + CALL_DAYS[m] * DAY).toISOString(),
        });
      }
    }
    if (inserts.length) {
      const { error: e } = await admin.from('veltrix_calls').upsert(inserts, { onConflict: 'token_key,multiple', ignoreDuplicates: true });
      if (!e) created = inserts.length;
    }
  }

  // ── 2) revisar los abiertos ──
  let hit = 0;
  let missed = 0;
  if (open.length) {
    const subset = open.slice(0, 90);
    const live = await getLivePrices(subset.map((c) => ({ chain: c.chain, address: c.address })));

    // Velas de 1 h para los menos revisados: así un pico entre dos revisiones sí se registra.
    const toCheck = subset
      .filter((c) => c.pair_address)
      .sort((a, b) => (Date.parse(a.checked_at ?? '') || 0) - (Date.parse(b.checked_at ?? '') || 0))
      .slice(0, MAX_CANDLE_CHECKS);
    const highs = new Map<string, number>();
    for (const c of toCheck) {
      if (deadline - Date.now() < 2_000) break;
      try {
        const candles = await getCandles(c.chain, c.pair_address as string, c.address, '1h', 200);
        const since = Date.parse(c.created_at) / 1000 - 3_600;
        highs.set(c.id, Math.max(0, ...candles.filter((k) => k.time >= since).map((k) => k.high)));
      } catch { /* sin velas esta vez: queda la revisión por precio */ }
    }

    for (const c of subset) {
      const l = live[`${c.chain}:${cacheSafeAddress(c.address)}`];
      if (!l || !(l.priceUsd > 0) || !(c.entry_price > 0)) continue; // sin dato confiable no se resuelve
      const peak = Math.max(c.peak_multiple, l.priceUsd / c.entry_price, (highs.get(c.id) ?? 0) / c.entry_price);
      const stamp = new Date().toISOString();
      let patch: Record<string, unknown> = { peak_multiple: peak };
      if (highs.has(c.id)) patch = { ...patch, checked_at: stamp };
      if (peak >= c.multiple) { patch = { ...patch, status: 'hit', hit_at: stamp, resolved_at: stamp }; hit++; }
      else if (Date.now() >= Date.parse(c.expires_at) || l.liquidityUsd < DEAD_LIQUIDITY) { patch = { ...patch, status: 'missed', resolved_at: stamp }; missed++; }
      await admin.from('veltrix_calls').update(patch).eq('id', c.id).eq('status', 'open');
    }
  }
  return { ok: true, created, openBefore: open.length, hit, missed };
}

export type { Multiple };
