import 'server-only';
import { cached } from '../cache';
import { cycleOf, isAlive, nextCycleOdds } from '../cycles';
import { getUniverse } from './candidates';
import type { ScanBoard, ScanItem } from '@/types/market';

/** Ranking de memecoins por ciclos de vida (ver src/lib/cycles.ts para la definición). Cache 60 s. */
export function getScanBoard(): Promise<ScanBoard> {
  return cached('scan-board', 60_000, async () => {
    const universe = await getUniverse();
    const now = Date.now();
    const items: ScanItem[] = [];
    for (const t of universe) {
      if (t.marketCap <= 0 || !isAlive(t.liquidityUsd, t.volume24h)) continue; // las muertas no entran al ranking
      const cycle = cycleOf(t.pairCreatedAt ? now - t.pairCreatedAt : null);
      if (cycle === 0) continue; // los lanzamientos de menos de 24 h viven en el Dashboard
      const o = cycle < 3 ? nextCycleOdds(t) : null;
      items.push({
        chain: t.chain,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        imageUrl: t.imageUrl,
        priceUsd: t.priceUsd,
        change24h: t.change24h,
        marketCap: t.marketCap,
        liquidityUsd: t.liquidityUsd,
        volume24h: t.volume24h,
        pairCreatedAt: t.pairCreatedAt,
        top10Pct: t.top10Pct,
        cycle,
        odds: o?.odds ?? null,
        oddsScore: o?.score ?? null,
        reasons: o?.reasons ?? [],
      });
    }
    items.sort((a, b) => b.cycle - a.cycle || b.marketCap - a.marketCap);
    return { items: items.slice(0, 250), updatedAt: now };
  });
}
