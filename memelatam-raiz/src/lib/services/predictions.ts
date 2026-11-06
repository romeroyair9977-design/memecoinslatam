import 'server-only';
import { createPublicSupabase } from '@/lib/supabase/server';

export interface PredictionStats { vive: number; muere: number }
export interface MyPrediction { horizon_days: number; side: 'vive' | 'muere'; status: 'open' | 'won' | 'lost'; resolves_at: string }
export interface LeaderRow {
  user_id: string; username: string; avatar_url: string | null;
  wins: number; losses: number; open_count: number; net_latam: number; best_horizon: number;
}

/** Cuántas predicciones abiertas hay de cada lado para un token. */
export async function getPredictionStats(key: string): Promise<PredictionStats> {
  const sb = createPublicSupabase();
  if (!sb) return { vive: 0, muere: 0 };
  const { data } = await sb.from('predictions').select('side').eq('token_key', key).eq('status', 'open').limit(2000);
  const rows = (data ?? []) as { side: 'vive' | 'muere' }[];
  return { vive: rows.filter((r) => r.side === 'vive').length, muere: rows.filter((r) => r.side === 'muere').length };
}

export async function getMyPredictions(userId: string, key: string): Promise<MyPrediction[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('predictions').select('horizon_days, side, status, resolves_at').eq('user_id', userId).eq('token_key', key).order('created_at', { ascending: false }).limit(10);
  return (data ?? []) as MyPrediction[];
}

/** Ranking: primero quien más aciertos tiene; desempata el saldo neto de $LATAM. */
export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('prediction_leaderboard').select('*').order('wins', { ascending: false }).order('net_latam', { ascending: false }).limit(limit);
  return (data ?? []) as LeaderRow[];
}
