import 'server-only';
import { cacheSafeAddress } from '../addresses';
import { CALL_DAYS, MAX_CALL_AGE_MS, MAX_CALL_TOP10, MIN_CALL_BUY_SHARE, MIN_CALL_FOMO, MIN_CALL_LIQ, callTiers, type Multiple } from '../potential';
import { createAdminSupabase } from '../supabase/server';
import { formatUsd } from '../utils';
import { getCandles } from './chart';
import { getFomoBoard } from './fomo';
import { getLivePrices } from './live';
import { toCall } from './potencial-map';
import { getRugCheckOverview } from './rugcheck';

export interface PotencialDiag {
  at: number;
  /** Embudo: cuántas monedas quedan después de cada filtro */
  funnel: { step: string; count: number }[];
  /** Las monedas de Solana con más FOMO y por qué entraron o no */
  candidates: { symbol: string; address: string; fomo: number; marketCap: number; ageHours: number | null; verdict: 'publicado' | 'rechazado'; reason: string }[];
}

export interface PotencialResult {
  ok: boolean;
  reason?: string;
  created: number;
  openBefore: number;
  hit: number;
  missed: number;
  diag: PotencialDiag | null;
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
  const empty = (reason: string): PotencialResult => ({ ok: false, reason, created: 0, openBefore: 0, hit: 0, missed: 0, diag: null });
  const admin = createAdminSupabase();
  if (!admin) return empty('missing_service_role');
  const deadline = Date.now() + TIME_BUDGET_MS;

  const { data: openRows, error } = await admin.from('veltrix_calls').select('*').eq('status', 'open');
  if (error) return empty('db');
  const open = ((openRows ?? []) as Record<string, unknown>[]).map(toCall);

  // ── 1) llamados nuevos ──
  let created = 0;
  let diag: PotencialDiag | null = null;
  if (open.length < MAX_OPEN_TOTAL) {
    const board = await getFomoBoard();
    const now = Date.now();
    const openKeys = new Set(open.map((c) => `${c.chain}:${cacheSafeAddress(c.address)}:${c.multiple}`));
    const ageH = (i: { pairCreatedAt: number | null }) => (i.pairCreatedAt ? (now - i.pairCreatedAt) / 3_600_000 : null);

    // Primer filtro que NO pasa cada moneda (para explicar por qué no se publicó).
    const firstFail = (i: (typeof board.items)[number]): string | null => {
      if (!(i.pairCreatedAt !== null && now - i.pairCreatedAt <= MAX_CALL_AGE_MS)) return `Tiene más de 72 horas (${Math.round(ageH(i) ?? 0)} h)`;
      if (!(i.priceUsd > 0) || i.liquidityUsd < MIN_CALL_LIQ) return `Liquidez baja (${formatUsd(i.liquidityUsd)}, mínimo ${formatUsd(MIN_CALL_LIQ)})`;
      if (i.fomo < MIN_CALL_FOMO) return `FOMO ${i.fomo} (mínimo ${MIN_CALL_FOMO})`;
      if (i.buyShare5 < MIN_CALL_BUY_SHARE) return `Solo ${Math.round(i.buyShare5 * 100)}% son compras (mínimo ${Math.round(MIN_CALL_BUY_SHARE * 100)}%)`;
      if (i.suspicious) return `Posible manipulación: ${i.flags[0] ?? 'señales raras'}`;
      if (callTiers(i.marketCap).length === 0) return `Market cap de ${formatUsd(i.marketCap)} (el máximo para un llamado es ${formatUsd(1_000_000)})`;
      return null;
    };

    const sol = board.items.filter((i) => i.chain === 'solana');
    const sRecent = sol.filter((i) => i.pairCreatedAt !== null && now - i.pairCreatedAt <= MAX_CALL_AGE_MS);
    const sLiq = sRecent.filter((i) => i.priceUsd > 0 && i.liquidityUsd >= MIN_CALL_LIQ);
    const sFomo = sLiq.filter((i) => i.fomo >= MIN_CALL_FOMO);
    const sBuy = sFomo.filter((i) => i.buyShare5 >= MIN_CALL_BUY_SHARE);
    const sClean = sBuy.filter((i) => !i.suspicious);
    const eligible = sClean.filter((i) => callTiers(i.marketCap).length > 0).slice(0, 12);

    const outcome = new Map<string, { verdict: 'publicado' | 'rechazado'; reason: string }>();
    const inserts: Record<string, unknown>[] = [];
    let tokens = 0;
    let checks = 0;
    let secPassed = 0;
    for (const it of eligible) {
      const tiers = callTiers(it.marketCap).filter((m) => !openKeys.has(`${it.chain}:${cacheSafeAddress(it.address)}:${m}`));
      if (tiers.length === 0) { outcome.set(it.address, { verdict: 'rechazado', reason: 'Ya tiene llamados abiertos' }); continue; }
      if (tokens >= MAX_NEW_TOKENS || checks >= MAX_RUGCHECKS || deadline - Date.now() < 3_000) { outcome.set(it.address, { verdict: 'rechazado', reason: 'Límite de verificaciones por corrida: se revisa en la próxima' }); continue; }
      checks++;
      const ov = await getRugCheckOverview(it.address);
      // Sin datos de seguridad confiables NO se publica: las monedas pequeñas son las que más se rugean.
      if (!ov) { outcome.set(it.address, { verdict: 'rechazado', reason: 'Sin datos de seguridad (RugCheck no respondió)' }); continue; }
      if (ov.security.rugged) { outcome.set(it.address, { verdict: 'rechazado', reason: 'RugCheck la marca como rug' }); continue; }
      if (ov.security.mintAuthorityActive) { outcome.set(it.address, { verdict: 'rechazado', reason: 'Mint authority activa (pueden crear más tokens)' }); continue; }
      if (ov.security.freezeAuthorityActive) { outcome.set(it.address, { verdict: 'rechazado', reason: 'Freeze authority activa (pueden congelar wallets)' }); continue; }
      const top10 = ov.holders.top10Pct ?? 100;
      if (top10 > MAX_CALL_TOP10) { outcome.set(it.address, { verdict: 'rechazado', reason: ov.holders.top10Pct === null ? 'Sin datos de holders' : `Top 10 controla ${top10.toFixed(0)}% (máximo ${MAX_CALL_TOP10}%)` }); continue; }
      secPassed++;
      tokens++;
      outcome.set(it.address, { verdict: 'publicado', reason: `Publicado en ${tiers.map((m) => `x${m}`).join(', ')}` });
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

    diag = {
      at: now,
      funnel: [
        { step: 'Memecoins vigiladas', count: board.items.length },
        { step: 'En Solana', count: sol.length },
        { step: 'Menos de 72 horas de vida', count: sRecent.length },
        { step: `Liquidez de al menos ${formatUsd(MIN_CALL_LIQ)}`, count: sLiq.length },
        { step: `FOMO de ${MIN_CALL_FOMO} o más`, count: sFomo.length },
        { step: `Mayoría de compras (${Math.round(MIN_CALL_BUY_SHARE * 100)}%+)`, count: sBuy.length },
        { step: 'Sin señales de manipulación', count: sClean.length },
        { step: `Market cap dentro de un nivel (hasta ${formatUsd(1_000_000)})`, count: eligible.length },
        { step: 'Pasan los filtros de seguridad', count: secPassed },
        { step: 'Llamados publicados (monedas)', count: tokens },
      ],
      candidates: sol.slice(0, 12).map((i) => {
        const o = outcome.get(i.address);
        const fail = firstFail(i);
        return {
          symbol: i.symbol,
          address: i.address,
          fomo: i.fomo,
          marketCap: i.marketCap,
          ageHours: ageH(i),
          verdict: o?.verdict ?? 'rechazado',
          reason: o ? o.reason : fail ?? 'Cumplía los filtros pero quedó fuera del límite de la corrida',
        };
      }),
    };
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
  return { ok: true, created, openBefore: open.length, hit, missed, diag };
}

export type { Multiple };
