/**
 * Arma el dashboard: junta candidatos (GeckoTerminal new/trending pools + perfiles/boosts de DexScreener),
 * los enriquece con datos de pares en batch y los clasifica.
 */
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { isSupportedChain } from '../chains';
import { TTL } from '../config';
import { computeActivity } from '../activity';
import { classify } from '../classify';
import { getCandidateRefs, getTokensBatch, pickPrimaryPair, type ProfileRef } from './dexscreener';
import { getNewPoolTokens, getTrendingPoolTokens } from './geckoterminal';
import type { Dashboard, Pair, TokenSummary } from '@/types/token';

const MAX_CANDIDATES = 120;
const MIN_LIQUIDITY = 1_000; // descarta pools vacíos/polvo

async function gatherCandidates(): Promise<ProfileRef[]> {
  const settled = await Promise.allSettled([
    getNewPoolTokens('solana'),
    getNewPoolTokens('base'),
    getTrendingPoolTokens('solana'),
    getTrendingPoolTokens('base'),
    getCandidateRefs(),
  ]);
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const seen = new Set<string>();
  const out: ProfileRef[] = [];
  for (const ref of all) {
    if (!isSupportedChain(ref.chain)) continue;
    const key = `${ref.chain}:${cacheSafeAddress(ref.address)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

function summarize(pairs: Pair[]): TokenSummary | null {
  const main = pickPrimaryPair(pairs);
  if (!main || main.liquidityUsd < MIN_LIQUIDITY) return null;
  const links = [...main.websites, ...main.socials];
  return {
    chain: main.chainId,
    address: main.baseToken.address,
    name: main.baseToken.name,
    symbol: main.baseToken.symbol,
    imageUrl: pairs.find((p) => p.imageUrl)?.imageUrl ?? null,
    priceUsd: main.priceUsd,
    change24h: main.priceChange.h24,
    marketCap: main.marketCap || main.fdv,
    liquidityUsd: main.liquidityUsd,
    volume24h: main.volume.h24,
    txns24h: main.txns.h24.buys + main.txns.h24.sells,
    pairCreatedAt: main.pairCreatedAt,
    dexId: main.dexId,
    tags: classify(pairs),
    activity: computeActivity(main, links).status,
    trendScore: main.volume.h1 * 4 + main.volume.h6 + main.boostsActive * 5_000,
  };
}

export function getDashboard(): Promise<Dashboard> {
  return cached('dashboard', TTL.dashboard, async () => {
    const candidates = await gatherCandidates();

    // Agrupa por chain y consulta en lotes de 30 (límite de DexScreener).
    const byChain = new Map<string, string[]>();
    for (const c of candidates) byChain.set(c.chain, [...(byChain.get(c.chain) ?? []), c.address]);

    const requests: Promise<Pair[]>[] = [];
    for (const [chain, addrs] of byChain)
      for (let i = 0; i < addrs.length; i += 30) requests.push(getTokensBatch(chain, addrs.slice(i, i + 30)));
    const pairs = (await Promise.allSettled(requests)).flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // Agrupa pares por token (chain + address del token base).
    const grouped = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), p]);
    }

    const all = [...grouped.values()].map(summarize).filter((s): s is TokenSummary => s !== null);
    const byAge = (a: TokenSummary, b: TokenSummary) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0);

    return {
      nuevas: all.filter((t) => t.tags.includes('new')).sort(byAge).slice(0, 12),
      traccion: all.filter((t) => t.tags.includes('traction')).sort((a, b) => b.volume24h - a.volume24h).slice(0, 12),
      migrando: all.filter((t) => t.tags.includes('migrating')).sort(byAge).slice(0, 12),
      trending: [...all].filter((t) => t.liquidityUsd >= 5_000).sort((a, b) => b.trendScore - a.trendScore).slice(0, 10),
      updatedAt: Date.now(),
    };
  });
}
