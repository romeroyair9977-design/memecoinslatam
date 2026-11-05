/** Reglas de las predicciones (los montos reales los aplica Postgres: supabase/migrations/0003_predicciones.sql). */
export const HORIZONS = [
  { days: 7, label: '1 semana', reward: 2 },
  { days: 30, label: '1 mes', reward: 6 },
  { days: 90, label: '3 meses', reward: 15 },
  { days: 180, label: '6 meses', reward: 30 },
] as const;

export const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'ia', label: 'Memes de IA' },
  { id: 'animales', label: 'Animales' },
  { id: 'celebridades', label: 'Celebridades / política' },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];

export type Side = 'vive' | 'muere';
export const MAX_PER_DAY = 5;
/** Para predecir, el token debe tener al menos esta liquidez (evita apostar sobre tokens ya muertos). */
export const MIN_LIQUIDITY_TO_PREDICT = 10_000;
/** "Viva" al vencer = liquidez y volumen 24 h por encima de estos mínimos. */
export const ALIVE_MIN_LIQUIDITY = 5_000;
export const ALIVE_MIN_VOLUME = 1_000;

export const rewardFor = (days: number, side: Side) => {
  const base = HORIZONS.find((h) => h.days === days)?.reward ?? 0;
  return side === 'muere' ? Math.max(1, Math.floor(base / 2)) : base;
};
export const horizonLabel = (days: number) => HORIZONS.find((h) => h.days === days)?.label ?? `${days} d`;
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export interface PredictionRow {
  id: string;
  user_id: string;
  token_key: string;
  side: Side;
  horizon_days: number;
  category: CategoryId;
  entry_liquidity: number;
  created_at: string;
  due_at: string;
  status: 'pending' | 'hit' | 'miss';
  reward: number;
  tokens?: { symbol: string; name: string; chain: string; address: string; image_url: string | null } | null;
  profiles?: { username: string } | null;
}

export interface LeaderRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  hits: number;
  misses: number;
  pending: number;
  earned: number;
  best_horizon: number;
}
