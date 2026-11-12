import 'server-only';
import { isTokenAlive } from '../predictions';
import { createAdminSupabase } from '../supabase/server';
import { getTokenByAddress } from './dexscreener';

interface Due { id: string; token_key: string; liquidity_at_open: number }
export interface ResolveResult { ok: boolean; reason?: string; due: number; resolved: number; skipped: number }

/**
 * Resuelve las predicciones de permanencia vencidas y paga los $LATAM. Si DexScreener no responde para un token,
 * NO se resuelve (se reintenta en la próxima corrida).
 */
export async function runResolvePredictions(): Promise<ResolveResult> {
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, reason: 'missing_service_role', due: 0, resolved: 0, skipped: 0 };

  const { data, error } = await admin.from('predictions').select('id, token_key, liquidity_at_open').eq('status', 'open').lte('resolves_at', new Date().toISOString()).limit(100);
  if (error) return { ok: false, reason: 'db', due: 0, resolved: 0, skipped: 0 };
  const due = (data ?? []) as Due[];

  const byToken = new Map<string, Due[]>();
  for (const d of due) byToken.set(d.token_key, [...(byToken.get(d.token_key) ?? []), d]);

  const deadline = Date.now() + 7_000;
  let resolved = 0;
  let skipped = 0;
  for (const [key, list] of byToken) {
    if (Date.now() > deadline) { skipped += list.length; continue; }
    const i = key.indexOf(':');
    const chain = key.slice(0, i);
    const address = key.slice(i + 1);
    let pairs;
    try {
      pairs = (await getTokenByAddress(address, { fresh: true })).filter((p) => p.chainId === chain);
    } catch {
      skipped += list.length;
      continue;
    }
    for (const p of list) {
      const { error: e } = await admin.rpc('resolve_prediction', { p_id: p.id, p_alive: isTokenAlive(pairs, Number(p.liquidity_at_open)) });
      if (e) skipped += 1; else resolved += 1;
    }
  }
  return { ok: true, due: due.length, resolved, skipped };
}
