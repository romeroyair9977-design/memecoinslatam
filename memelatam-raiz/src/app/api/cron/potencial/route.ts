import { NextResponse } from 'next/server';
import { cacheSafeAddress } from '@/lib/addresses';
import { CALL_DAYS, MULTIPLES, potentialScore, type Multiple } from '@/lib/potential';
import { getUniverse } from '@/lib/services/candidates';
import { getLivePrices } from '@/lib/services/live';
import { toCall } from '@/lib/services/potential';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const NEW_PER_TIER_PER_RUN = 2; // freno anti-spam: pocos llamados, bien escogidos
const MAX_OPEN_PER_TIER = 15;
const DEAD_LIQUIDITY = 1_000;
const DAY = 86_400_000;

/**
 * 1) Propone llamados nuevos (x10 / x100 / x1000) con las reglas de src/lib/potential.ts.
 * 2) Revisa los abiertos: si el precio ya llegó al múltiplo → "hit"; si venció el plazo o el token murió → "missed".
 * Llámala cada 30 min con un cron externo:  GET /api/cron/potencial   Authorization: Bearer <CRON_SECRET>
 * Límite honesto: el pico se mide en cada revisión; un salto más corto que el intervalo puede no registrarse.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const { data: openRows, error } = await admin.from('veltrix_calls').select('*').eq('status', 'open');
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  const open = ((openRows ?? []) as Record<string, unknown>[]).map(toCall);

  // ── 1) llamados nuevos ──
  const now = Date.now();
  const universe = await getUniverse();
  const openKeys = new Set(open.map((c) => `${c.chain}:${cacheSafeAddress(c.address)}:${c.multiple}`));
  const openPerTier = new Map<Multiple, number>(MULTIPLES.map((m) => [m, open.filter((c) => c.multiple === m).length]));
  const addedPerTier = new Map<Multiple, number>(MULTIPLES.map((m) => [m, 0]));

  const scored = universe
    .filter((t) => t.priceUsd > 0 && t.marketCap > 0)
    .map((t) => ({ t, r: potentialScore({ ...t, ageMs: t.pairCreatedAt ? now - t.pairCreatedAt : null }) }))
    .filter((x) => x.r.tier !== null)
    .sort((a, b) => b.r.score - a.r.score);

  const inserts: Record<string, unknown>[] = [];
  for (const { t, r } of scored) {
    const tier = r.tier as Multiple;
    const key = `${t.chain}:${cacheSafeAddress(t.address)}:${tier}`;
    if (openKeys.has(key)) continue;
    if ((addedPerTier.get(tier) ?? 0) >= NEW_PER_TIER_PER_RUN) continue;
    if ((openPerTier.get(tier) ?? 0) + (addedPerTier.get(tier) ?? 0) >= MAX_OPEN_PER_TIER) continue;
    addedPerTier.set(tier, (addedPerTier.get(tier) ?? 0) + 1);
    inserts.push({
      token_key: `${t.chain}:${cacheSafeAddress(t.address)}`,
      chain: t.chain,
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      image: t.imageUrl,
      multiple: tier,
      entry_price: t.priceUsd,
      entry_mc: t.marketCap,
      target_mc: t.marketCap * tier,
      score: r.score,
      reasons: r.reasons.slice(0, 5),
      expires_at: new Date(now + CALL_DAYS[tier] * DAY).toISOString(),
    });
  }
  let created = 0;
  if (inserts.length) {
    const { error: e } = await admin.from('veltrix_calls').upsert(inserts, { onConflict: 'token_key,multiple', ignoreDuplicates: true });
    if (!e) created = inserts.length;
  }

  // ── 2) revisar los abiertos ──
  let hit = 0;
  let missed = 0;
  if (open.length) {
    const live = await getLivePrices(open.slice(0, 90).map((c) => ({ chain: c.chain, address: c.address })));
    for (const c of open.slice(0, 90)) {
      const l = live[`${c.chain}:${cacheSafeAddress(c.address)}`];
      if (!l || !(l.priceUsd > 0) || !(c.entry_price > 0)) continue; // sin dato confiable no se resuelve
      const peak = Math.max(c.peak_multiple, l.priceUsd / c.entry_price);
      const stamp = new Date().toISOString();
      let patch: Record<string, unknown> = { peak_multiple: peak };
      if (peak >= c.multiple) { patch = { ...patch, status: 'hit', hit_at: stamp, resolved_at: stamp }; hit++; }
      else if (Date.now() >= Date.parse(c.expires_at) || l.liquidityUsd < DEAD_LIQUIDITY) { patch = { ...patch, status: 'missed', resolved_at: stamp }; missed++; }
      await admin.from('veltrix_calls').update(patch).eq('id', c.id).eq('status', 'open');
    }
  }

  return NextResponse.json({ candidates: scored.length, created, openBefore: open.length, hit, missed });
}
