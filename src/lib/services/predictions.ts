import 'server-only';
import { cached } from '../cache';
import { isSupportedChain } from '../chains';
import { ALIVE_MIN_LIQUIDITY, ALIVE_MIN_VOLUME, type LeaderRow, type PredictionRow } from '../predictions';
import { createAdminSupabase, createPublicSupabase } from '../supabase/server';
import { getTokenByAddress } from './dexscreener';

const SELECT = '*, tokens(symbol, name, chain, address, image_url), profiles(username)';

/** Ranking por categoría ('all' suma todas). Orden: premios ganados → aciertos → mejor plazo acertado. */
export async function getLeaderboard(category: string, limit = 25): Promise<LeaderRow[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  let q = sb.from('prediction_leaderboard').select('*');
  if (category !== 'all') q = q.eq('category', category);
  const { data } = await q.limit(1000);
  const by = new Map<string, LeaderRow>();
  for (const r of (data ?? []) as LeaderRow[]) {
    const cur = by.get(r.user_id);
    if (!cur) by.set(r.user_id, { ...r });
    else {
      cur.hits += r.hits; cur.misses += r.misses; cur.pending += r.pending; cur.earned += r.earned;
      cur.best_horizon = Math.max(cur.best_horizon, r.best_horizon);
    }
  }
  return [...by.values()]
    .filter((r) => r.hits + r.misses > 0)
    .sort((a, b) => b.earned - a.earned || b.hits - a.hits || b.best_horizon - a.best_horizon)
    .slice(0, limit);
}

export async function getRecentPredictions(limit = 12): Promise<PredictionRow[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('predictions').select(SELECT).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as PredictionRow[];
}

export async function getUserPredictions(userId: string, limit = 30): Promise<PredictionRow[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('predictions').select(SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as PredictionRow[];
}

/** ¿Sigue "viva"? null = no se pudo saber (error de la API): en ese caso NO se resuelve y se reintenta luego. */
async function isAlive(tokenKey: string): Promise<boolean | null> {
  const i = tokenKey.indexOf(':');
  const chain = tokenKey.slice(0, i);
  const address = tokenKey.slice(i + 1);
  if (!isSupportedChain(chain)) return null;
  try {
    const pairs = (await getTokenByAddress(address)).filter((p) => p.chainId === chain);
    if (!pairs.length) return false; // DexScreener ya no lo lista: se considera muerto
    const liq = Math.max(...pairs.map((p) => p.liquidityUsd));
    const vol = pairs.reduce((s, p) => s + p.volume.h24, 0);
    return liq >= ALIVE_MIN_LIQUIDITY && vol >= ALIVE_MIN_VOLUME;
  } catch {
    return null;
  }
}

/**
 * Resuelve las predicciones vencidas (máx. 40 por pasada). Se llama al abrir /predicciones (con tope de 1 vez cada
 * 5 min por instancia) y desde /api/cron/predicciones si configuras un cron externo. Idempotente: la RPC solo
 * resuelve filas pendientes y vencidas.
 */
export function resolveDuePredictions(): Promise<number> {
  return cached('predictions:resolve', 5 * 60_000, async () => {
    const admin = createAdminSupabase();
    if (!admin) return 0;
    const { data } = await admin.from('predictions').select('id, token_key').eq('status', 'pending').lte('due_at', new Date().toISOString()).order('due_at').limit(40);
    let done = 0;
    for (const row of (data ?? []) as { id: string; token_key: string }[]) {
      const alive = await isAlive(row.token_key);
      if (alive === null) continue;
      const { error } = await admin.rpc('resolve_prediction', { p_id: row.id, p_alive: alive });
      if (!error) done++;
    }
    return done;
  });
}
