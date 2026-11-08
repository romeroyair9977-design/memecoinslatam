import 'server-only';
import { cached } from '../cache';
import { DAY } from '../cycles';
import { toWhales, whaleRisk, whaleScenarios } from '../whales';
import { getUniverse } from './candidates';
import { getRugCheckOverview } from './rugcheck';
import type { WhaleBoard, WhaleToken } from '@/types/market';

const MAX_TOKENS = 40;
const BUDGET_MS = 6_000; // lo que no alcance queda en cache de RugCheck (5 min) y entra en la próxima corrida
const CONCURRENCY = 6;

/**
 * Tablero de ballenas (solo Solana por ahora: RugCheck es la única fuente gratuita con holders uno a uno).
 * Para cada token calcula qué pasaría con el precio si venden la ballena #1, las 2, 3 o 5 primeras.
 */
export function getWhaleBoard(): Promise<WhaleBoard> {
  return cached('whale-board', 120_000, async () => {
    const universe = await getUniverse();
    const list = universe
      .filter((t) => t.chain === 'solana' && t.marketCap >= 100_000 && t.liquidityUsd >= 20_000)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, MAX_TOKENS);

    const deadline = Date.now() + BUDGET_MS;
    const done = new Map<string, Awaited<ReturnType<typeof getRugCheckOverview>>>();
    let next = 0;
    const worker = async () => {
      while (next < list.length && Date.now() < deadline) {
        const t = list[next++];
        const r = await Promise.race([
          getRugCheckOverview(t.address),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), Math.max(0, deadline - Date.now()))),
        ]);
        if (r !== undefined) done.set(t.address, r);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const now = Date.now();
    const items: WhaleToken[] = [];
    for (const t of list) {
      const ov = done.get(t.address);
      if (!ov || ov.holders.holders.length === 0) continue;
      const whales = toWhales(ov.holders.holders, t.marketCap, 5);
      const scenarios = whaleScenarios(whales, t.liquidityUsd);
      items.push({
        chain: t.chain,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        imageUrl: t.imageUrl,
        marketCap: t.marketCap,
        liquidityUsd: t.liquidityUsd,
        pairCreatedAt: t.pairCreatedAt,
        established: t.pairCreatedAt !== null && now - t.pairCreatedAt >= 7 * DAY,
        whales,
        whaleUsd: whales.reduce((n, w) => n + w.usd, 0),
        top1Pct: whales[0]?.pct ?? 0,
        top3Pct: whales.slice(0, 3).reduce((n, w) => n + w.pct, 0),
        scenarios,
        risk: whaleRisk(scenarios),
      });
    }
    items.sort((a, b) => b.whaleUsd - a.whaleUsd);
    return { items, scanned: done.size, pending: list.length - done.size, updatedAt: now };
  });
}
