/**
 * Datos del gráfico propio (velas + compras/ventas reales del pool) desde GeckoTerminal (API pública, sin key).
 * Así dibujamos el gráfico nosotros en vez de incrustar el de otro sitio.
 */
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { toGeckoNetwork } from '../chains';
import { fetchJson } from '../http';

const BASE = 'https://api.geckoterminal.com/api/v2';
const HEADERS = { accept: 'application/json;version=20230302' };

export const TIMEFRAMES = {
  '5m': { path: 'minute', aggregate: 5 },
  '15m': { path: 'minute', aggregate: 15 },
  '1h': { path: 'hour', aggregate: 1 },
  '4h': { path: 'hour', aggregate: 4 },
  '1d': { path: 'day', aggregate: 1 },
} as const;
export type Timeframe = keyof typeof TIMEFRAMES;
export const isTimeframe = (v: string): v is Timeframe => v in TIMEFRAMES;

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number } // t = segundos (unix)
export interface ChartTrade {
  t: number; // segundos (unix)
  side: 'buy' | 'sell';
  price: number; // USD por token
  usd: number;
  wallet: string;
  tx: string;
}
export interface ChartData { candles: Candle[]; trades: ChartTrade[] }

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
};

interface RawOhlcv { data?: { attributes?: { ohlcv_list?: unknown[][] } } }
interface RawTrades {
  data?: {
    attributes?: {
      block_timestamp?: string;
      tx_hash?: string;
      tx_from_address?: string;
      kind?: string;
      volume_in_usd?: string;
      from_token_address?: string;
      to_token_address?: string;
      price_from_in_usd?: string;
      price_to_in_usd?: string;
    };
  }[];
}

async function fetchCandles(network: string, pool: string, token: string, tf: Timeframe): Promise<Candle[]> {
  const { path, aggregate } = TIMEFRAMES[tf];
  const url = `${BASE}/networks/${network}/pools/${pool}/ohlcv/${path}?aggregate=${aggregate}&limit=200&currency=usd&token=${token}`;
  const raw = await fetchJson<RawOhlcv>(url, { revalidate: 20, headers: HEADERS });
  const list = raw.data?.attributes?.ohlcv_list ?? [];
  return list
    .map((r) => ({ t: num(r[0]), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) }))
    .filter((c) => [c.t, c.o, c.h, c.l, c.c].every(Number.isFinite) && c.c > 0)
    .map((c) => ({ ...c, v: Number.isFinite(c.v) ? c.v : 0 }))
    .sort((a, b) => a.t - b.t);
}

/** Últimas operaciones del pool (GeckoTerminal devuelve hasta 300 de las últimas 24 h). */
async function fetchTrades(network: string, pool: string, token: string): Promise<ChartTrade[]> {
  const raw = await fetchJson<RawTrades>(`${BASE}/networks/${network}/pools/${pool}/trades`, { revalidate: 20, headers: HEADERS });
  const me = token.toLowerCase();
  const out: ChartTrade[] = [];
  for (const d of raw.data ?? []) {
    const a = d.attributes;
    if (!a?.tx_from_address || !a.block_timestamp) continue;
    // "buy/sell" de GeckoTerminal es respecto al token base del pool; nosotros lo calculamos respecto a NUESTRO token.
    const to = a.to_token_address?.toLowerCase();
    const from = a.from_token_address?.toLowerCase();
    let side: 'buy' | 'sell';
    let price: number;
    if (to === me) { side = 'buy'; price = num(a.price_to_in_usd); }
    else if (from === me) { side = 'sell'; price = num(a.price_from_in_usd); }
    else continue;
    const t = Math.floor(Date.parse(a.block_timestamp) / 1000);
    const usd = num(a.volume_in_usd);
    if (!Number.isFinite(t) || !(price > 0) || !Number.isFinite(usd)) continue;
    out.push({ t, side, price, usd, wallet: a.tx_from_address, tx: a.tx_hash ?? '' });
  }
  return out.sort((a, b) => a.t - b.t);
}

export async function getChartData(chain: string, pool: string, token: string, tf: Timeframe): Promise<ChartData | null> {
  const network = toGeckoNetwork(chain);
  if (!network) return null;
  const tok = cacheSafeAddress(token);
  const candles = await cached(`chart:c:${chain}:${cacheSafeAddress(pool)}:${tok}:${tf}`, 20_000, () => fetchCandles(network, pool, token, tf), 60_000);
  if (!candles.length) return null;
  // Las operaciones son un extra: si fallan (límite de la API) igual mostramos las velas.
  const trades = await cached(`chart:t:${chain}:${cacheSafeAddress(pool)}:${tok}`, 30_000, () => fetchTrades(network, pool, token), 60_000).catch(() => [] as ChartTrade[]);
  return { candles, trades };
}
