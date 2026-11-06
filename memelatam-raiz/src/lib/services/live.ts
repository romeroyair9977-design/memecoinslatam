/**
 * Datos de mercado "en vivo". A diferencia de `getTokenFull`, NO consulta RugCheck ni GeckoTerminal:
 * una sola llamada a DexScreener, sin cache de Next y con 3 s de cache en memoria para que muchos usuarios
 * compartan la misma consulta. Por eso responde rápido y se puede pedir cada pocos segundos.
 */
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { TTL } from '../config';
import { pairToLive } from '../live';
import { getTokenByAddress, getTokensBatch, pickPrimaryPair } from './dexscreener';
import type { LiveMarket, Pair } from '@/types/token';

export async function getLiveMarket(address: string, chain?: string): Promise<LiveMarket | null> {
  const pairs = await getTokenByAddress(address, { fresh: true });
  const scoped = chain ? pairs.filter((p) => p.chainId === chain) : pairs;
  const main = pickPrimaryPair(scoped.length ? scoped : pairs);
  return main ? pairToLive(main) : null;
}

export interface TokenRef { chain: string; address: string }

/** Precios de varios tokens a la vez (lotes de 30 por chain). Clave del resultado: `chain:address` (EVM en minúsculas). */
export async function getLivePrices(refs: TokenRef[]): Promise<Record<string, LiveMarket>> {
  // Clave canónica → muchos usuarios con la misma lista comparten una sola consulta.
  const sorted = [...refs].sort((a, b) => `${a.chain}:${a.address}`.localeCompare(`${b.chain}:${b.address}`));
  const cacheKey = `live:prices:${sorted.map((r) => `${r.chain}:${cacheSafeAddress(r.address)}`).join(',')}`;

  return cached(cacheKey, TTL.live, async () => {
    const byChain = new Map<string, string[]>();
    for (const r of sorted) byChain.set(r.chain, [...(byChain.get(r.chain) ?? []), r.address]);

    const jobs: Promise<Pair[]>[] = [];
    for (const [chain, addrs] of byChain)
      for (let i = 0; i < addrs.length; i += 30) jobs.push(getTokensBatch(chain, addrs.slice(i, i + 30), { fresh: true }));
    const pairs = (await Promise.allSettled(jobs)).flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    const grouped = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), p]);
    }
    const out: Record<string, LiveMarket> = {};
    for (const [key, ps] of grouped) {
      const main = pickPrimaryPair(ps);
      if (main) out[key] = pairToLive(main);
    }
    return out;
  });
}
