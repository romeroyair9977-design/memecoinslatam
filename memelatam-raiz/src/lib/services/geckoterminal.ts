/**
 * GeckoTerminal (API pública, sin key, ~30 req/min). Docs: https://api.geckoterminal.com/docs
 * Aporta: metadata del token, distribución de holders (todas las chains) y pools nuevos/trending.
 */
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { fromGeckoNetwork, toGeckoNetwork } from '../chains';
import { TTL } from '../config';
import { fetchJson } from '../http';
import type { HolderStats, TokenInfo } from '@/types/token';
import type { ProfileRef } from './dexscreener';

const BASE = 'https://api.geckoterminal.com/api/v2';
const HEADERS = { accept: 'application/json;version=20230302' };

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

interface RawInfo {
  data?: {
    attributes?: {
      description?: string | null;
      websites?: string[] | null;
      twitter_handle?: string | null;
      telegram_handle?: string | null;
      discord_url?: string | null;
      gt_score?: number | null;
      categories?: string[] | null;
      holders?: {
        count?: number | null;
        distribution_percentage?: { top_10?: string | number | null } | null;
      } | null;
    };
  };
}

export interface GeckoOverview {
  info: TokenInfo;
  /** Solo resumen de concentración (sin lista de wallets) */
  holders: HolderStats | null;
}

/** Metadata + resumen de holders de un token. Devuelve null si GeckoTerminal no lo conoce. */
export async function getGeckoOverview(chain: string, address: string): Promise<GeckoOverview | null> {
  const network = toGeckoNetwork(chain);
  if (!network) return null;

  return cached(`gecko:info:${chain}:${cacheSafeAddress(address)}`, TTL.info, async () => {
    try {
      const raw = await fetchJson<RawInfo>(`${BASE}/networks/${network}/tokens/${address}/info`, {
        revalidate: 600,
        headers: HEADERS,
      });
      const a = raw.data?.attributes;
      if (!a) return null;

      const top10 = num(a.holders?.distribution_percentage?.top_10);
      const info: TokenInfo = {
        description: a.description ?? null,
        websites: a.websites ?? [],
        twitterHandle: a.twitter_handle ?? null,
        telegramHandle: a.telegram_handle ?? null,
        discordUrl: a.discord_url ?? null,
        gtScore: a.gt_score ?? null,
        categories: a.categories ?? [],
      };
      const holders: HolderStats | null =
        top10 !== null || a.holders?.count
          ? { source: 'geckoterminal', totalHolders: a.holders?.count ?? null, top10Pct: top10, top1Pct: null, holders: [] }
          : null;
      return { info, holders };
    } catch {
      return null; // 404 / rate-limit: degradamos sin romper la página
    }
  });
}

interface RawPools {
  data?: { relationships?: { base_token?: { data?: { id?: string } } } }[];
}

/** id de GeckoTerminal: "solana_<address>" → { chain, address } */
function parseTokenId(id: string | undefined): ProfileRef | null {
  if (!id) return null;
  const i = id.indexOf('_');
  const chain = fromGeckoNetwork(id.slice(0, i));
  return chain ? { chain, address: id.slice(i + 1) } : null;
}

/** Pools recién creados (fuente principal de "Recién lanzadas"). */
export async function getNewPoolTokens(chain: string): Promise<ProfileRef[]> {
  return poolTokens(chain, 'new_pools');
}

/** Pools en tendencia en GeckoTerminal. */
export async function getTrendingPoolTokens(chain: string): Promise<ProfileRef[]> {
  return poolTokens(chain, 'trending_pools');
}

async function poolTokens(chain: string, kind: 'new_pools' | 'trending_pools'): Promise<ProfileRef[]> {
  const network = toGeckoNetwork(chain);
  if (!network) return [];
  return cached(`gecko:${kind}:${chain}`, TTL.dashboard, async () => {
    const raw = await fetchJson<RawPools>(`${BASE}/networks/${network}/${kind}`, {
      revalidate: 60,
      headers: HEADERS,
    });
    return (raw.data ?? [])
      .map((p) => parseTokenId(p.relationships?.base_token?.data?.id))
      .filter((x): x is ProfileRef => x !== null);
  });
}
