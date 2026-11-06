import { NextResponse } from 'next/server';
import { assessCandidate, MIN_VALID_LIQ_FOR_HIT, TIER_DAYS, type Candidate } from '@/lib/potencial';
import { getDashboard } from '@/lib/services/dashboard';
import { getTokensBatch, pickPrimaryPair } from '@/lib/services/dexscreener';
import { looksLikeMeme } from '@/lib/services/rankings';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Pair, TokenSummary } from '@/types/token';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const MAX_OPEN = 60;        // tope de llamadas abiertas: calidad antes que cantidad
const MAX_NEW_PER_RUN = 3;  // nuevas llamadas por corrida
const CHECK_LIMIT = 150;

interface OpenRow { id: number; chain: string; address: string; target_x: number; entry_price: number | string; peak_price: number | string; expires_at: string }

/**
 * Radar x10 · x100 · x1000. Llámala cada 30 min con un cron externo gratuito (cron-job.org):
 *   GET https://TU-DOMINIO/api/cron/scan-calls   con la cabecera   Authorization: Bearer <CRON_SECRET>
 * 1) Revisa las llamadas abiertas: actualiza precio y pico; las marca "hit" si llegaron a la meta, "miss" si
 *    se vencieron o el token quedó sin liquidez. 2) Registra hasta 3 candidatas nuevas que pasan las reglas.
 * El pico se mide solo en cada revisión: puede quedarse corto si el precio sube y baja entre dos corridas.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'sin service_role' }, { status: 500 });

  const now = Date.now();
  const iso = new Date(now).toISOString();
  let checked = 0, hits = 0, misses = 0, created = 0;

  // 1) Revisar abiertas
  const { data: openData, error } = await admin
    .from('scan_calls')
    .select('id, chain, address, target_x, entry_price, peak_price, expires_at')
    .eq('status', 'open')
    .order('called_at', { ascending: true })
    .limit(CHECK_LIMIT);
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  const open = (openData ?? []) as OpenRow[];

  const byChain = new Map<string, OpenRow[]>();
  for (const r of open) byChain.set(r.chain, [...(byChain.get(r.chain) ?? []), r]);

  const updates: { id: number; patch: Record<string, unknown> }[] = [];
  for (const [chain, rows] of byChain) {
    const pairsBy = new Map<string, Pair[]>();
    for (let i = 0; i < rows.length; i += 30) {
      try {
        const pairs = await getTokensBatch(chain, rows.slice(i, i + 30).map((r) => r.address), { fresh: true });
        for (const p of pairs) {
          const key = p.baseToken.address.toLowerCase();
          pairsBy.set(key, [...(pairsBy.get(key) ?? []), p]);
        }
      } catch {
        // sin datos confiables en este lote: no se toca nada, se reintenta en la próxima corrida
      }
    }
    for (const r of rows) {
      const entry = Number(r.entry_price);
      const target = r.target_x;
      const pairs = pairsBy.get(r.address.toLowerCase());
      const main = pairs ? pickPrimaryPair(pairs) : null;
      const patch: Record<string, unknown> = { last_checked_at: iso };
      let peak = Number(r.peak_price);
      let status: 'open' | 'hit' | 'miss' = 'open';
      if (main) {
        checked += 1;
        patch.last_price = main.priceUsd;
        if (main.liquidityUsd >= MIN_VALID_LIQ_FOR_HIT && main.priceUsd > peak) peak = main.priceUsd;
        patch.peak_price = peak;
        if (peak >= entry * target) status = 'hit';
        else if (main.liquidityUsd < 1_000) status = 'miss'; // el token se vació
      }
      if (status === 'open' && now > Date.parse(r.expires_at)) status = 'miss';
      if (status !== 'open') {
        patch.status = status;
        patch.resolved_at = iso;
        if (status === 'hit') hits += 1; else misses += 1;
      }
      updates.push({ id: r.id, patch });
    }
  }
  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(updates.slice(i, i + 10).map((u) => admin.from('scan_calls').update(u.patch).eq('id', u.id)));
  }

  // 2) Registrar candidatas nuevas (solo si hay cupo)
  const stillOpen = open.length - hits - misses;
  if (stillOpen < MAX_OPEN) {
    try {
      const dash = await getDashboard();
      const scored: { t: TokenSummary; c: Candidate }[] = [];
      for (const t of dash.tokens) {
        if (!looksLikeMeme(t)) continue;
        const c = assessCandidate(t, now);
        if (c) scored.push({ t, c });
      }
      const picks = scored.sort((a, b) => b.c.score - a.c.score).slice(0, Math.min(MAX_NEW_PER_RUN, MAX_OPEN - stillOpen));
      if (picks.length) {
        const rows = picks.map(({ t, c }) => ({
          chain: t.chain,
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          image_url: t.imageUrl,
          target_x: c.tier,
          entry_price: t.priceUsd,
          entry_mcap: t.marketCap,
          entry_liquidity: t.liquidityUsd,
          score: Math.round(c.score * 10) / 10,
          reasons: c.reasons,
          peak_price: t.priceUsd,
          last_price: t.priceUsd,
          expires_at: new Date(now + TIER_DAYS[c.tier] * 86_400_000).toISOString(),
        }));
        // ignoreDuplicates: si el token ya tuvo una llamada, no se repite ni se reescribe su historial.
        const { data: inserted } = await admin.from('scan_calls').upsert(rows, { onConflict: 'chain,address', ignoreDuplicates: true }).select('id');
        created = inserted?.length ?? 0;
      }
    } catch {
      // el dashboard puede tardar: se intenta de nuevo en la próxima corrida
    }
  }

  return NextResponse.json({ checked, hits, misses, created, stillOpen: stillOpen + created });
}
