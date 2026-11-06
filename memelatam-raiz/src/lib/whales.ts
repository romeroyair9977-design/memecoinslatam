import type { HolderStats } from '@/types/token';

/** Una "ballena" = wallet (que no es un pool) con al menos este % del supply. */
export const WHALE_PCT = 1;

export interface WhaleReport {
  /** Cantidad total de holders reportada por la fuente (null si no se conoce). */
  totalHolders: number | null;
  /** Wallets grandes entre los mayores holders (≥ WHALE_PCT del supply). */
  whales: { address: string; pct: number; isInsider: boolean }[];
  whalesPct: number;
  insiders: number;
  top1Pct: number | null;
  /** Cuántos holders de la lista se pudieron revisar (RugCheck entrega hasta 20). */
  checked: number;
}

/** Código puro: resume cuántas personas tienen el token y si hay ballenas. */
export function buildWhaleReport(stats: HolderStats | null): WhaleReport | null {
  if (!stats) return null;
  const whales = stats.holders
    .filter((h) => h.pct >= WHALE_PCT)
    .map((h) => ({ address: h.address, pct: h.pct, isInsider: Boolean(h.isInsider) }));
  return {
    totalHolders: stats.totalHolders,
    whales,
    whalesPct: whales.reduce((s, w) => s + w.pct, 0),
    insiders: stats.holders.filter((h) => h.isInsider).length,
    top1Pct: stats.top1Pct,
    checked: stats.holders.length,
  };
}
