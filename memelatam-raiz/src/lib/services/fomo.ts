import 'server-only';
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { looksAi } from '../ai';
import { isSupportedChain } from '../chains';
import { computeMomentum, flowFromPair } from '../momentum';
import { getDashboard } from './dashboard';
import { getTokensBatch, isAiHinted, pickPrimaryPair, type ProfileRef } from './dexscreener';
import { getWideTokenRefs } from './geckoterminal';
import type { Pair } from '@/types/token';
import type { FomoBoard, FomoItem } from '@/types/market';

const MAX_REFS = 160;
const MIN_LIQUIDITY = 3_000;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const keyOf = (t: { chain: string; address: string }) => `${t.chain}:${cacheSafeAddress(t.address)}`;

/**
 * Lista de tokens a vigilar: los del dashboard (con su top 10 de holders) + una red ancha de GeckoTerminal
 * (pools nuevos, en tendencia y con más transacciones, Solana y Base). Se renueva cada 45 s.
 */
function getFomoRefs(): Promise<{ refs: ProfileRef[]; top10: Map<string, number | null> }> {
  return cached('fomo-refs', 45_000, async () => {
    const dash = await getDashboard().catch(() => null);
    const top10 = new Map<string, number | null>();
    const seen = new Set<string>();
    const refs: ProfileRef[] = [];
    const add = (r: ProfileRef) => {
      if (!isSupportedChain(r.chain) || seen.has(keyOf(r))) return;
      seen.add(keyOf(r));
      refs.push(r);
    };
    for (const t of dash?.tokens ?? []) {
      add({ chain: t.chain, address: t.address });
      top10.set(keyOf(t), t.top10Pct);
    }
    const wide = await Promise.allSettled([getWideTokenRefs('solana'), getWideTokenRefs('base')]);
    for (const w of wide) if (w.status === 'fulfilled') w.value.forEach(add);
    return { refs: refs.slice(0, MAX_REFS), top10 };
  });
}

/**
 * Ranking de FOMO en vivo: consulta DexScreener sin cache (3 s) y mide, por token, qué tan rápido entran las compras
 * ahora frente a hace un rato. Ver src/lib/momentum.ts para la fórmula y sus límites.
 */
export function getFomoBoard(): Promise<FomoBoard> {
  return cached('fomo-board', 5_000, async () => {
    const { refs, top10 } = await getFomoRefs();

    const byChain = new Map<string, string[]>();
    for (const r of refs) byChain.set(r.chain, [...(byChain.get(r.chain) ?? []), r.address]);
    const jobs: Promise<Pair[]>[] = [];
    for (const [chain, addrs] of byChain)
      for (let i = 0; i < addrs.length; i += 30) jobs.push(getTokensBatch(chain, addrs.slice(i, i + 30), { fresh: true }));
    const pairs = (await Promise.allSettled(jobs)).flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    const grouped = new Map<string, Pair[]>();
    for (const p of pairs) {
      const k = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
      grouped.set(k, [...(grouped.get(k) ?? []), p]);
    }

    const now = Date.now();
    const items: FomoItem[] = [];
    for (const [k, ps] of grouped) {
      const main = pickPrimaryPair(ps);
      if (!main || main.liquidityUsd < MIN_LIQUIDITY) continue;
      const mc = main.marketCap || main.fdv;
      if (mc <= 0) continue;
      const ageMs = main.pairCreatedAt ? now - main.pairCreatedAt : null;
      const m = computeMomentum({ flow: flowFromPair(main), ageMs, liquidityUsd: main.liquidityUsd, priceChangeM5: main.priceChange.m5 });
      const hasX = main.socials.some((s) => s.type === 'twitter');
      const hasWebsite = main.websites.length > 0;
      items.push({
        chain: main.chainId,
        address: main.baseToken.address,
        pairAddress: main.pairAddress,
        symbol: main.baseToken.symbol,
        name: main.baseToken.name,
        imageUrl: ps.find((p) => p.imageUrl)?.imageUrl ?? null,
        dex: main.dexId,
        priceUsd: main.priceUsd,
        change5m: main.priceChange.m5,
        change1h: main.priceChange.h1,
        change24h: main.priceChange.h24,
        marketCap: mc,
        liquidityUsd: main.liquidityUsd,
        volume1h: main.volume.h1,
        pairCreatedAt: main.pairCreatedAt,
        buysPerMin: m.buysPerMin,
        accel: m.accel,
        buyShare5: m.buyShare5,
        state: m.state,
        fomo: m.fomo,
        quality: Math.round(0.55 * m.fomo + (hasX ? 12 : 0) + (hasWebsite ? 8 : 0) + 25 * clamp01(Math.log10(Math.max(main.liquidityUsd, 1) / 5_000) / 1.5)),
        reasons: m.reasons,
        hasX,
        hasWebsite,
        ai: looksAi(main.baseToken.name, main.baseToken.symbol) || isAiHinted(main.chainId, main.baseToken.address),
        top10Pct: top10.get(k) ?? null,
      });
    }
    items.sort((a, b) => b.fomo - a.fomo);
    return { items: items.slice(0, 120), scanned: grouped.size, updatedAt: now };
  });
}
