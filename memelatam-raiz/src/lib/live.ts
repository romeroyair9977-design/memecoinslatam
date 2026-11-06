import type { LiveMarket, Pair } from '@/types/token';

/** Resumen liviano de un par (serializable). Código puro: sirve en servidor y navegador. */
export function pairToLive(p: Pair): LiveMarket {
  return {
    priceUsd: p.priceUsd,
    change: p.priceChange,
    marketCap: p.marketCap,
    fdv: p.fdv,
    liquidityUsd: p.liquidityUsd,
    volume24h: p.volume.h24,
    buys24h: p.txns.h24.buys,
    sells24h: p.txns.h24.sells,
    pairAddress: p.pairAddress,
    pairCreatedAt: p.pairCreatedAt,
    updatedAt: Date.now(),
  };
}
