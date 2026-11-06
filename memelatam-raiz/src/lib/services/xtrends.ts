import 'server-only';
import { cached } from '../cache';
import { isSupportedChain } from '../chains';
import { createPublicSupabase } from '../supabase/server';
import { getTokenByAddress, pickPrimaryPair, searchPairs } from './dexscreener';
import type { Pair } from '@/types/token';
import type { XTrendItem, XTrendToken, XTrendsResult } from '@/types/xtrends';

interface RpcRow {
  term_: string;
  kind_: 'cashtag' | 'address';
  mentions_: number;
  authors_: number;
  engagement_: number | string;
  recent_: number;
  previous_: number;
  momentum_: number | string;
}

const toToken = (p: Pair): XTrendToken => ({
  chain: p.chainId,
  address: p.baseToken.address,
  symbol: p.baseToken.symbol,
  name: p.baseToken.name,
  imageUrl: p.imageUrl,
  priceUsd: p.priceUsd,
  change24h: p.priceChange.h24,
  liquidityUsd: p.liquidityUsd,
  marketCap: p.marketCap || p.fdv,
});

interface Resolved { token: XTrendToken | null; ambiguous: boolean }

/**
 * Convierte un término de X en un token real de DexScreener.
 *  - address: se consulta directo.
 *  - $cashtag: se busca por símbolo y se elige el de más liquidez; si hay otro token con el mismo símbolo y liquidez
 *    parecida (≥ 25 %), se marca como ambiguo (los cashtags no son únicos: la dirección sí).
 */
async function resolveTerm(term: string, kind: 'cashtag' | 'address'): Promise<Resolved> {
  return cached(`x:resolve:${term}`, 5 * 60_000, async (): Promise<Resolved> => {
    if (kind === 'address') {
      const main = pickPrimaryPair((await getTokenByAddress(term)).filter((p) => isSupportedChain(p.chainId)));
      return { token: main ? toToken(main) : null, ambiguous: false };
    }
    const sym = term.slice(1);
    const best = new Map<string, Pair>();
    for (const p of await searchPairs(sym)) {
      if (!isSupportedChain(p.chainId) || p.baseToken.symbol.toLowerCase() !== sym || p.liquidityUsd < 1_000) continue;
      const k = `${p.chainId}:${p.baseToken.address}`;
      const prev = best.get(k);
      if (!prev || p.liquidityUsd > prev.liquidityUsd) best.set(k, p);
    }
    const ranked = [...best.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    if (ranked.length === 0) return { token: null, ambiguous: false };
    return { token: toToken(ranked[0]), ambiguous: ranked.length > 1 && ranked[1].liquidityUsd >= ranked[0].liquidityUsd * 0.25 };
  }).catch((): Resolved => ({ token: null, ambiguous: false })); // un fallo de DexScreener no se cachea ni rompe la lista
}

async function mapPool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/** Ranking de menciones en X para una ventana (1, 6 o 24 horas), ya enlazado a tokens reales. Cache 60 s. */
export async function getXTrends(hours: 1 | 6 | 24): Promise<XTrendsResult> {
  return cached(`xtrends:${hours}`, 60_000, async () => {
    const sb = createPublicSupabase();
    if (!sb) throw new Error('Supabase no configurado');

    const [{ data, error }, { data: state }] = await Promise.all([
      sb.rpc('x_trending', { p_hours: hours, p_limit: 40 }),
      sb.from('x_scan_state').select('last_until, updated_at').eq('id', 1).maybeSingle(),
    ]);
    if (error) throw new Error('No se pudo leer el ranking de X');

    const rows = (data ?? []) as RpcRow[];
    const resolved = await mapPool(rows, 6, (r) => resolveTerm(r.term_, r.kind_));

    const items: XTrendItem[] = [];
    rows.forEach((r, i) => {
      const { token, ambiguous } = resolved[i];
      if (!token) return; // términos que no son un token real (palabras, errores) se descartan
      items.push({
        term: r.term_,
        kind: r.kind_,
        mentions: r.mentions_,
        authors: r.authors_,
        engagement: Number(r.engagement_),
        recent: r.recent_,
        previous: r.previous_,
        momentum: Number(r.momentum_),
        token,
        ambiguous,
      });
    });

    const scanned = state && Number(state.last_until) > 0 ? (state.updated_at as string) : null;
    return { items, hours, updatedAt: Date.now(), lastScanAt: scanned };
  });
}
