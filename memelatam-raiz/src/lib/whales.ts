/**
 * Escenarios de venta de ballenas. Código puro (sin fetch): sirve en servidor y navegador.
 *
 * MODELO: pool de producto constante (Raydium CPMM, Uniswap V2, PumpSwap…) con liquidez total L (mitad token, mitad USD).
 * Si se vende un valor V (al precio actual), con k = 1 + 2V/L:
 *   precio final / precio inicial = 1 / k²      → caída = 1 − 1/k²
 *   dinero que realmente se recibe = V / k      (por el deslizamiento, nunca se recibe todo V)
 * Es una aproximación: ignora liquidez concentrada, ventas escalonadas, compradores que entran y tokens bloqueados/quemados
 * (el valor de cada ballena usa market cap × % del supply).
 */
import type { Holder } from '@/types/token';

export interface WhaleHolder { address: string; pct: number; usd: number; isInsider: boolean }
export interface WhaleScenario {
  whales: number;
  label: string;
  sellPct: number;
  sellUsd: number;
  priceDropPct: number;
  proceedsUsd: number;
}
export type WhaleRisk = 'critico' | 'alto' | 'medio' | 'bajo';

export function sellImpact(sellUsd: number, liquidityUsd: number): { dropPct: number; proceedsUsd: number } {
  if (!(sellUsd > 0)) return { dropPct: 0, proceedsUsd: 0 };
  if (!(liquidityUsd > 0)) return { dropPct: 100, proceedsUsd: 0 };
  const k = 1 + (2 * sellUsd) / liquidityUsd;
  return { dropPct: (1 - 1 / (k * k)) * 100, proceedsUsd: sellUsd / k };
}

export function toWhales(holders: Holder[], valueUsd: number, max = 5): WhaleHolder[] {
  return [...holders]
    .sort((a, b) => b.pct - a.pct)
    .slice(0, max)
    .map((h) => ({ address: h.address, pct: h.pct, usd: (h.pct / 100) * valueUsd, isInsider: Boolean(h.isInsider) }));
}

const STEPS = [
  { whales: 1, label: 'Vende la ballena #1' },
  { whales: 2, label: 'Venden las 2 primeras' },
  { whales: 3, label: 'Venden las 3 primeras' },
  { whales: 5, label: 'Venden las 5 primeras' },
] as const;

export function whaleScenarios(whales: WhaleHolder[], liquidityUsd: number): WhaleScenario[] {
  return STEPS.filter((s) => whales.length >= s.whales).map((s) => {
    const group = whales.slice(0, s.whales);
    const sellUsd = group.reduce((n, w) => n + w.usd, 0);
    const sellPct = group.reduce((n, w) => n + w.pct, 0);
    const { dropPct, proceedsUsd } = sellImpact(sellUsd, liquidityUsd);
    return { whales: s.whales, label: s.label, sellPct, sellUsd, priceDropPct: dropPct, proceedsUsd };
  });
}

/** Qué tan frágil es el precio si venden las ballenas. */
export function whaleRisk(scenarios: WhaleScenario[]): WhaleRisk {
  const one = scenarios.find((s) => s.whales === 1)?.priceDropPct ?? 0;
  const three = scenarios.find((s) => s.whales === 3)?.priceDropPct ?? scenarios[scenarios.length - 1]?.priceDropPct ?? 0;
  if (one >= 50) return 'critico';
  if (one >= 25 || three >= 70) return 'alto';
  if (three >= 35) return 'medio';
  return 'bajo';
}

export const WHALE_RISK_LABEL: Record<WhaleRisk, string> = {
  critico: 'Frágil: una ballena lo hunde',
  alto: 'Frágil',
  medio: 'Riesgo medio',
  bajo: 'Resiste ventas de ballenas',
};
