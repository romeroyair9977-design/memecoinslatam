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
    flow: {
      m5: { buys: p.txns.m5.buys, sells: p.txns.m5.sells, volume: p.volume.m5 },
      h1: { buys: p.txns.h1.buys, sells: p.txns.h1.sells, volume: p.volume.h1 },
      h6: { buys: p.txns.h6.buys, sells: p.txns.h6.sells, volume: p.volume.h6 },
      h24: { buys: p.txns.h24.buys, sells: p.txns.h24.sells, volume: p.volume.h24 },
    },
  };
}
