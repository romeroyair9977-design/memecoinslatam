/**
 * Radar x10 · x100 · x1000. Código PURO (sin fetch): reglas de selección, metas y estadísticas.
 * Importante: son reglas heurísticas para PRIORIZAR revisión, no predicciones de precio ni consejos de inversión.
 * La credibilidad viene de registrar cada llamada al momento y contar también las que fallan.
 */
import type { TokenSummary } from '@/types/token';

export const TIERS = [10, 100, 1000] as const;
export type Tier = (typeof TIERS)[number];

/** Plazo (días) que tiene cada meta para cumplirse antes de contarse como fallida. */
export const TIER_DAYS: Record<Tier, number> = { 10: 14, 100: 30, 1000: 60 };

/** Un pico solo cuenta si el token tenía al menos esta liquidez (evita precios falsos de pools vacíos). */
export const MIN_VALID_LIQ_FOR_HIT = 3_000;

const HOUR = 3_600_000;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

/** Meta según el market cap de entrada: cuanto más chico, más espacio teórico para crecer. */
export function tierForMarketCap(mc: number): Tier {
  if (mc <= 30_000) return 1000;
  if (mc <= 300_000) return 100;
  return 10;
}

export interface Candidate { tier: Tier; score: number; reasons: string[] }

/** Devuelve la meta y el puntaje si el token pasa TODAS las reglas de calidad; si no, null. */
export function assessCandidate(t: TokenSummary, now = Date.now()): Candidate | null {
  if (!t.pairCreatedAt || t.priceUsd <= 0) return null;
  const ageH = (now - t.pairCreatedAt) / HOUR;
  if (ageH < 2 || ageH > 24 * 7) return null; // ni recién nacido ni viejo
  if (t.marketCap < 5_000 || t.marketCap > 2_000_000) return null;
  if (t.liquidityUsd < 15_000 || t.volume24h < 25_000) return null;
  const liqRatio = t.liquidityUsd / t.marketCap;
  if (liqRatio < 0.05) return null; // liquidez demasiado fina frente al market cap
  if (t.activity !== 'activo') return null;
  if (t.buys24h < t.sells24h * 1.1) return null; // sin presión compradora
  if (t.top10Pct !== null && t.top10Pct > 45) return null; // pocas manos controlan el supply
  if (t.change24h > 400 || t.change24h < -30) return null; // ya explotó, o viene cayendo

  const tier = tierForMarketCap(t.marketCap);
  const buyRatio = t.buys24h / (t.sells24h + 1);
  const score =
    Math.log10(t.volume24h) * 10 +
    Math.min(buyRatio, 3) * 10 +
    (t.top10Pct !== null ? (45 - t.top10Pct) / 3 : 0) +
    Math.min(liqRatio, 0.5) * 20;

  const reasons = [
    `Market cap $${k(t.marketCap)}: la meta x${tier} sería $${k(t.marketCap * tier)}`,
    `${t.buys24h} compras vs ${t.sells24h} ventas en 24 h`,
    `Liquidez $${k(t.liquidityUsd)} (${Math.round(liqRatio * 100)}% del market cap) y volumen 24 h $${k(t.volume24h)}`,
    t.top10Pct !== null ? `Top 10 de holders: ${t.top10Pct.toFixed(0)}% del supply` : 'Concentración de holders aún sin medir',
  ];
  return { tier, score, reasons };
}

export interface CallRow {
  id: number;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  target: Tier;
  entryPrice: number;
  entryMcap: number;
  peakPrice: number;
  lastPrice: number;
  status: 'open' | 'hit' | 'miss';
  calledAt: number;
  expiresAt: number;
  resolvedAt: number | null;
  reasons: string[];
}

export const multipleOf = (price: number, entry: number) => (entry > 0 ? price / entry : 0);

export interface TierStats {
  tier: Tier;
  total: number;
  hits: number;
  misses: number;
  open: number;
  /** aciertos / (aciertos + fallos). null mientras no haya llamadas resueltas. */
  rate: number | null;
  bestMultiple: number;
}

export function computeStats(rows: CallRow[]): TierStats[] {
  return TIERS.map((tier) => {
    const mine = rows.filter((r) => r.target === tier);
    const hits = mine.filter((r) => r.status === 'hit').length;
    const misses = mine.filter((r) => r.status === 'miss').length;
    return {
      tier,
      total: mine.length,
      hits,
      misses,
      open: mine.filter((r) => r.status === 'open').length,
      rate: hits + misses > 0 ? hits / (hits + misses) : null,
      bestMultiple: mine.reduce((m, r) => Math.max(m, multipleOf(r.peakPrice, r.entryPrice)), 0),
    };
  });
}
