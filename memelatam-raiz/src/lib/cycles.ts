/**
 * Ciclos de vida de una memecoin (definición de Veltrix, ajustable aquí):
 *   Ciclo 0 · menos de 24 h        (lanzamiento)
 *   Ciclo 1 · 24 h a 7 días        (sobrevivió el pico de lanzamiento)
 *   Ciclo 2 · 7 a 30 días          (sigue viva tras la primera semana)
 *   Ciclo 3 · 30 días o más        (veterana)
 * Se mide con la edad del pool principal y solo cuentan las que siguen vivas (liquidez ≥ 5.000 USD y volumen ≥ 1.000 USD/día).
 */
export const DAY = 86_400_000;
export type CycleNum = 0 | 1 | 2 | 3;
export type Odds = 'alta' | 'media' | 'baja';

export const CYCLE_LABEL: Record<CycleNum, string> = {
  0: 'Lanzamiento (menos de 24 h)',
  1: 'Ciclo 1 (1 a 7 días)',
  2: 'Ciclo 2 (7 a 30 días)',
  3: 'Ciclo 3 (30+ días)',
};

export const MIN_ALIVE_LIQ = 5_000;
export const MIN_ALIVE_VOL = 1_000;

export const isAlive = (liquidityUsd: number, volume24h: number) => liquidityUsd >= MIN_ALIVE_LIQ && volume24h >= MIN_ALIVE_VOL;

export function cycleOf(ageMs: number | null): CycleNum {
  if (ageMs === null) return 0;
  const d = ageMs / DAY;
  return d >= 30 ? 3 : d >= 7 ? 2 : d >= 1 ? 1 : 0;
}

export interface OddsInput {
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  buys24h: number;
  sells24h: number;
  top10Pct: number | null;
}
export interface OddsResult { odds: Odds; score: number; reasons: { text: string; good: boolean }[] }

/**
 * ¿Qué opción tiene de llegar al siguiente ciclo? Heurística sobre liquidez, volumen, presión de venta y concentración.
 * No predice el futuro: sirve para separar las que están sanas de las que casi seguro se apagan.
 */
export function nextCycleOdds(i: OddsInput): OddsResult {
  let score = 50;
  const reasons: { text: string; good: boolean }[] = [];
  const add = (pts: number, text: string) => { score += pts; reasons.push({ text, good: pts > 0 }); };

  const ratio = i.marketCap > 0 ? i.liquidityUsd / i.marketCap : 0;
  if (ratio >= 0.1) add(15, 'Buena liquidez frente a su market cap');
  else if (ratio < 0.02) add(-15, 'Liquidez muy baja frente a su market cap');

  const vol = i.liquidityUsd > 0 ? i.volume24h / i.liquidityUsd : 0;
  if (vol >= 0.2 && vol <= 15) add(10, 'Volumen sano frente a la liquidez');
  else if (vol < 0.05) add(-15, 'Casi sin volumen');
  else if (vol > 50) add(-10, 'Volumen desproporcionado (posible wash trading)');

  const total = i.buys24h + i.sells24h;
  if (total >= 50) {
    const buyShare = i.buys24h / total;
    if (buyShare >= 0.45) add(5, 'Compras y ventas equilibradas');
    else if (buyShare < 0.35) add(-10, 'Muchas más ventas que compras');
  }

  if (i.top10Pct !== null) {
    if (i.top10Pct <= 30) add(15, `Top 10 solo controla ${i.top10Pct.toFixed(0)}%`);
    else if (i.top10Pct > 60) add(-20, `Top 10 controla ${i.top10Pct.toFixed(0)}%`);
    else if (i.top10Pct > 50) add(-8, `Top 10 controla ${i.top10Pct.toFixed(0)}%`);
  }

  if (i.liquidityUsd >= 100_000) add(10, 'Liquidez sólida');
  else if (i.liquidityUsd < 15_000) add(-10, 'Liquidez frágil');

  score = Math.max(0, Math.min(100, score));
  return { odds: score >= 60 ? 'alta' : score >= 40 ? 'media' : 'baja', score, reasons };
}
