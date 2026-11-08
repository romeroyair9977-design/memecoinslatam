/**
 * "Potencial": escenarios x10 / x100 / x1000. Código puro.
 * IMPORTANTE: son escenarios y no promesas. Nadie puede predecir el precio de una memecoin; Veltrix registra cada
 * llamado con su fecha y luego lo marca como cumplido o fallado, para que se pueda auditar el historial.
 */
export const MULTIPLES = [10, 100, 1000] as const;
export type Multiple = (typeof MULTIPLES)[number];

/** Plazo de cada llamado: pasado ese tiempo sin llegar a la meta, se marca como fallado. */
export const CALL_DAYS: Record<Multiple, number> = { 10: 30, 100: 90, 1000: 180 };

/** Market cap máximo razonable para una meta (500 M USD): evita llamados absurdos. */
export const MAX_TARGET_MC = 500_000_000;

/**
 * Dinero de compra neta necesario para empujar el precio ×x en un pool de producto constante con liquidez L:
 *   Δ = (L / 2) · (√x − 1)
 * Modelo simplificado: no cuenta la liquidez que entra por el camino ni las ventas que habrá.
 */
export function buyCapitalNeeded(liquidityUsd: number, x: number): number {
  return liquidityUsd > 0 ? (liquidityUsd / 2) * (Math.sqrt(x) - 1) : 0;
}

export interface PotentialInput {
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  buys24h: number;
  sells24h: number;
  ageMs: number | null;
  top10Pct: number | null;
  activity: 'activo' | 'tibio' | 'fantasma';
}
export interface PotentialResult { score: number; tier: Multiple | null; reasons: string[] }

export function potentialScore(i: PotentialInput): PotentialResult {
  let score = 40;
  const reasons: string[] = [];
  const add = (pts: number, text?: string) => { score += pts; if (text && pts > 0) reasons.push(text); };

  const ratio = i.marketCap > 0 ? i.liquidityUsd / i.marketCap : 0;
  if (ratio >= 0.08) add(12, 'Liquidez alta frente a su market cap'); else if (ratio < 0.03) add(-12);

  const vol = i.liquidityUsd > 0 ? i.volume24h / i.liquidityUsd : 0;
  if (vol >= 0.3 && vol <= 15) add(10, 'Volumen sano frente a la liquidez'); else if (vol < 0.1) add(-12);

  const total = i.buys24h + i.sells24h;
  if (total >= 50) {
    const buyShare = i.buys24h / total;
    if (buyShare >= 0.5) add(8, 'Más compras que ventas'); else if (buyShare < 0.4) add(-10);
  }

  if (i.top10Pct !== null) {
    if (i.top10Pct <= 30) add(12, 'Holders bien repartidos'); else if (i.top10Pct > 50) add(-15);
  }

  if (i.activity === 'activo') add(10, 'Comunidad y actividad reales'); else if (i.activity === 'fantasma') add(-15);

  if (i.ageMs !== null) {
    const d = i.ageMs / 86_400_000;
    if (d >= 1 && d <= 14) add(8, 'Ya superó el lanzamiento y sigue creciendo'); else if (d < 0.1) add(-10);
  }

  if (i.liquidityUsd >= 30_000) add(6); else if (i.liquidityUsd < 10_000) add(-12);

  score = Math.max(0, Math.min(100, Math.round(score)));
  // Cuanto más grande el múltiplo, más exigente la nota y más chico debe ser el market cap actual.
  const tier: Multiple | null =
    score >= 80 && i.marketCap > 0 && i.marketCap <= 500_000 && i.liquidityUsd >= 20_000 ? 1000
    : score >= 65 && i.marketCap > 0 && i.marketCap <= 5_000_000 ? 100
    : score >= 52 && i.marketCap > 0 && i.marketCap <= 50_000_000 ? 10
    : null;
  return { score, tier, reasons };
}
