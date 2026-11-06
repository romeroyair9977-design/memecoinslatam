/**
 * Reglas de las predicciones de permanencia. Código puro (sin fetch): lo usan el servidor y la UI.
 * Si cambias algo aquí, cambia también supabase/migrations/0003_predicciones.sql (montos y plazos).
 */
import { LATAM } from './latam';
import type { Pair } from '@/types/token';

export const HORIZONS = [7, 30, 90] as const;
export type Horizon = (typeof HORIZONS)[number];
export type Side = 'vive' | 'muere';

export const MIN_ALIVE_LIQUIDITY = 5_000;
export const MIN_ALIVE_RATIO = 0.3;
export const MIN_ALIVE_VOLUME_24H = 1_000;

export const PREDICTION_COST = LATAM.predictionStake;
export const PREDICTION_PAYOUT = LATAM.predictionPayout;

/** Texto de la regla, para mostrarlo tal cual en la UI. */
export const ALIVE_RULE = `Cuenta como "viva" si sigue listada, su liquidez es de al menos ${MIN_ALIVE_LIQUIDITY.toLocaleString('en-US')} USD y 30 % de la que tenía al predecir, y mueve más de ${MIN_ALIVE_VOLUME_24H.toLocaleString('en-US')} USD al día.`;

/** ¿Sigue viva? `pairs` son los pares actuales del token (vacío = ya no existe). */
export function isTokenAlive(pairs: Pair[], liquidityAtOpen: number): boolean {
  if (pairs.length === 0) return false;
  const best = pairs.reduce((a, b) => (b.liquidityUsd > a.liquidityUsd ? b : a));
  const need = Math.max(MIN_ALIVE_LIQUIDITY, liquidityAtOpen * MIN_ALIVE_RATIO);
  const volume = Math.max(...pairs.map((p) => p.volume.h24));
  return best.liquidityUsd >= need && volume >= MIN_ALIVE_VOLUME_24H;
}
