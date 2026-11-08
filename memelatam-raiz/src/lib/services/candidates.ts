import 'server-only';
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { computeActivity } from '../activity';
import { getDashboard } from './dashboard';
import { getTokensBatch, pickPrimaryPair } from './dexscreener';
import { getTopPoolTokens } from './geckoterminal';
import type { Pair, TokenSummary } from '@/types/token';

/** Monedas base / estables / staking: no son memecoins y llenan los pools más grandes. */
const EXCLUDE = new Set([
  'sol', 'wsol', 'usdc', 'usdt', 'eth', 'weth', 'wbtc', 'btc', 'cbbtc', 'cbeth', 'usds', 'dai', 'jitosol', 'msol',
  'bsol', 'steth', 'wsteth', 'usd1', 'pyusd', 'eurc',
]);

const keyOf = (t: { chain: string; address: string }) => `${t.chain}:${cacheSafeAddress(t.address)}`;

function summarize(pairs: Pair[]): TokenSummary | null {
  const main = pickPrimaryPair(pairs);
  if (!main) return null;
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
    buys24h: main.txns.h24.buys,
    sells24h: main.txns.h24.sells,
    txns24h: main.txns.h24.buys + main.txns.h24.sells,
    pairCreatedAt: main.pairCreatedAt,
    dexId: main.dexId,
    dexCount: new Set(pairs.map((p) => p.dexId)).size,
    top10Pct: null,
    activity: computeActivity(main, [...main.websites, ...main.socials]).status,
    trendScore: main.volume.h1 * 4 + main.volume.h6,
  };
}

/**
 * Universo de tokens para Scan, Ballenas y Potencial: los del dashboard (nuevos y en tendencia, con top 10 de holders)
 * más los pools con más volumen de Solana y Base (tokens ya establecidos). Cache 60 s.
 */
export function getUniverse(): Promise<TokenSummary[]> {
  return cached('universe', 60_000, async () => {
    const dash = await getDashboard().catch(() => null);
    const known = new Map<string, TokenSummary>();
    for (const t of dash?.tokens ?? []) known.set(keyOf(t), t);

    const settled = await Promise.allSettled([getTopPoolTokens('solana'), getTopPoolTokens('base')]);
    const refs = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((r) => !known.has(keyOf(r)));

    const byChain = new Map<string, Set<string>>();
    for (const r of refs) byChain.set(r.chain, (byChain.get(r.chain) ?? new Set<string>()).add(r.address));

    const jobs: Promise<Pair[]>[] = [];
    for (const [chain, set] of byChain) {
      const addrs = [...set];
      for (let i = 0; i < addrs.length; i += 30) jobs.push(getTokensBatch(chain, addrs.slice(i, i + 30)));
    }
    const pairs = (await Promise.allSettled(jobs)).flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    const grouped = new Map<string, Pair[]>();
    for (const p of pairs) {
      const k = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
      grouped.set(k, [...(grouped.get(k) ?? []), p]);
    }
    for (const ps of grouped.values()) {
      const s = summarize(ps);
      if (s && !EXCLUDE.has(s.symbol.toLowerCase())) known.set(keyOf(s), s);
    }
    return [...known.values()];
  });
}
