/** Velas OHLCV y trades recientes de un pool (GeckoTerminal, sin key, ~30 req/min). */
import { cached } from '../cache';
import { toGeckoNetwork } from '../chains';
import { fetchJson } from '../http';
import type { Candle, TraderRow } from '@/types/token';

const BASE = 'https://api.geckoterminal.com/api/v2';
const HEADERS = { accept: 'application/json;version=20230302' };

export const TIMEFRAMES = {
  '1m': { unit: 'minute', agg: 1 },
  '5m': { unit: 'minute', agg: 5 },
  '15m': { unit: 'minute', agg: 15 },
  '1h': { unit: 'hour', agg: 1 },
  '4h': { unit: 'hour', agg: 4 },
  '1d': { unit: 'day', agg: 1 },
} as const;
export type Timeframe = keyof typeof TIMEFRAMES;
export const isTimeframe = (v: string): v is Timeframe => v in TIMEFRAMES;

export async function getCandles(chain: string, pair: string, token: string, tf: Timeframe, limit: number): Promise<Candle[]> {
  const network = toGeckoNetwork(chain);
  if (!network) return [];
  const { unit, agg } = TIMEFRAMES[tf];
  return cached(`gecko:ohlcv:${chain}:${pair}:${tf}:${limit}`, 4_000, async () => {
    const raw = await fetchJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(
      `${BASE}/networks/${network}/pools/${pair}/ohlcv/${unit}?aggregate=${agg}&limit=${limit}&currency=usd&token=${token}`,
      { revalidate: 0, headers: HEADERS },
    );
    const list = raw.data?.attributes?.ohlcv_list ?? [];
    const seen = new Set<number>();
    return list
      .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
      .filter((c) => Number.isFinite(c.time) && !seen.has(c.time) && seen.add(c.time))
      .sort((a, b) => a.time - b.time);
  });
}

interface RawTrade {
  attributes?: { tx_from_address?: string; kind?: string; volume_in_usd?: string; block_timestamp?: string };
}

/**
 * "Traders más movidos": agrupa los últimos trades del pool por wallet. Es ACTIVIDAD reciente (volumen comprado/vendido),
 * no ganancias: calcular PnL real por wallet necesita un proveedor con key (Birdeye / Helius / Solscan).
 */
export async function getTopTraders(chain: string, pair: string): Promise<TraderRow[]> {
  const network = toGeckoNetwork(chain);
  if (!network) return [];
  return cached(`gecko:traders:${chain}:${pair}`, 20_000, async () => {
    const raw = await fetchJson<{ data?: RawTrade[] }>(`${BASE}/networks/${network}/pools/${pair}/trades`, {
      revalidate: 0,
      headers: HEADERS,
    });
    const by = new Map<string, TraderRow>();
    for (const t of raw.data ?? []) {
      const a = t.attributes;
      const addr = a?.tx_from_address;
      const usd = Number(a?.volume_in_usd ?? 0);
      if (!addr || !Number.isFinite(usd)) continue;
      const row = by.get(addr) ?? { address: addr, trades: 0, buyUsd: 0, sellUsd: 0, netUsd: 0, lastAt: 0 };
      row.trades += 1;
      if (a?.kind === 'buy') row.buyUsd += usd; else row.sellUsd += usd;
      row.lastAt = Math.max(row.lastAt, a?.block_timestamp ? Date.parse(a.block_timestamp) || 0 : 0);
      by.set(addr, row);
    }
    return [...by.values()]
      .map((r) => ({ ...r, netUsd: r.buyUsd - r.sellUsd }))
      .sort((a, b) => b.buyUsd + b.sellUsd - (a.buyUsd + a.sellUsd))
      .slice(0, 12);
  });
}
