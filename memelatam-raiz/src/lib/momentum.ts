/**
 * Impulso (FOMO) de una memecoin a partir de lo que informa DexScreener por ventanas de 5 min, 1 h y 6 h.
 * Código puro. Límites honestos: la ventana más corta es de 5 minutos (no hay datos "por segundo") y se cuentan
 * COMPRAS, no personas distintas: una sola persona puede hacer muchas compras.
 */
import type { Pair, TimeWindow } from '@/types/token';

export interface Flow { buys: number; sells: number; volume: number }
export type FlowSet = Record<TimeWindow, Flow>;
export type MomentumState = 'acelerando' | 'sostenido' | 'enfriandose' | 'colapsando';

export const MOMENTUM_LABEL: Record<MomentumState, string> = {
  acelerando: 'Acelerando',
  sostenido: 'Sostenido',
  enfriandose: 'Enfriándose',
  colapsando: 'Colapsando',
};

export function flowFromPair(p: Pair): FlowSet {
  const w = (k: TimeWindow): Flow => ({ buys: p.txns[k].buys, sells: p.txns[k].sells, volume: p.volume[k] });
  return { m5: w('m5'), h1: w('h1'), h6: w('h6'), h24: w('h24') };
}

export interface MomentumInput {
  flow: FlowSet;
  ageMs: number | null;
  liquidityUsd: number;
  priceChangeM5: number;
}

export interface MomentumResult {
  state: MomentumState;
  /** 0–100 */
  fomo: number;
  /** compras por minuto en los últimos 5 min */
  buysPerMin: number;
  /** compras/min de los últimos 5 min ÷ compras/min del resto de la hora (1 = igual que antes) */
  accel: number;
  buyShare5: number;
  buyShare1h: number;
  volAccel: number;
  reasons: { text: string; good: boolean }[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeMomentum(i: MomentumInput): MomentumResult {
  const { m5, h1 } = i.flow;
  // Minutos reales de la última hora: un token de 20 min no tiene 60 min de historia.
  const minutes = Math.min(60, i.ageMs === null ? 60 : Math.max(6, i.ageMs / 60_000));
  const baseMin = Math.max(1, minutes - 5);

  const buysPerMin = m5.buys / 5;
  const baseBuys = Math.max(0, h1.buys - m5.buys) / baseMin;
  const accel = buysPerMin / Math.max(baseBuys, 0.3);

  const t5 = m5.buys + m5.sells;
  const t1 = h1.buys + h1.sells;
  const buyShare5 = t5 >= 8 ? m5.buys / t5 : 0.5;
  const buyShare1h = t1 >= 20 ? h1.buys / t1 : 0.5;
  const volAccel = m5.volume / 5 / Math.max(Math.max(0, h1.volume - m5.volume) / baseMin, 1);

  const fomo = Math.round(
    30 * clamp01(buysPerMin / 20) +
      25 * clamp01(Math.log2(Math.max(accel, 1)) / 3) +
      20 * clamp01((buyShare5 - 0.5) / 0.3) +
      10 * clamp01(Math.log2(Math.max(volAccel, 1)) / 3) +
      10 * clamp01(i.priceChangeM5 / 10) +
      (i.liquidityUsd >= 20_000 ? 5 : i.liquidityUsd >= 5_000 ? 2 : 0),
  );

  let state: MomentumState = 'sostenido';
  if (t5 >= 8 && buyShare5 < 0.4 && (i.priceChangeM5 < 0 || buyShare1h < 0.5)) state = 'colapsando';
  else if ((accel < 0.7 && t1 >= 20) || (t5 >= 8 && buyShare5 < 0.5)) state = 'enfriandose';
  else if (accel >= 1.5 && buyShare5 >= 0.55 && buysPerMin >= 2) state = 'acelerando';

  const reasons: MomentumResult['reasons'] = [];
  if (t5 >= 8) reasons.push({ text: `${Math.round(buyShare5 * 100)}% de las operaciones de los últimos 5 min son compras`, good: buyShare5 >= 0.5 });
  if (t1 >= 20 && baseBuys > 0) reasons.push({ text: accel >= 1 ? `Las compras van ${accel.toFixed(1)}× más rápido que en el resto de la hora` : `Las compras van a ${Math.round(accel * 100)}% del ritmo de la hora`, good: accel >= 1 });
  if (i.liquidityUsd < 5_000) reasons.push({ text: 'Liquidez muy baja: cualquier venta mueve mucho el precio', good: false });
  if (t5 < 8) reasons.push({ text: 'Casi sin operaciones en los últimos 5 minutos', good: false });

  return { state, fomo: Math.max(0, Math.min(100, fomo)), buysPerMin, accel, buyShare5, buyShare1h, volAccel, reasons };
}

export const fomoLabel = (score: number) => (score >= 75 ? 'Explosivo' : score >= 55 ? 'Caliente' : score >= 35 ? 'Tibio' : 'Frío');
