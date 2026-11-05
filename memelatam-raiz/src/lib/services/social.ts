/**
 * "Lo que se habla en X": cuenta menciones de memecoins (por $TICKER y por contrato) en tweets recientes.
 * Usa la API oficial de X (búsqueda reciente). Necesita X_BEARER_TOKEN de un plan de pago: el plan gratuito
 * NO permite buscar. Sin token, la página muestra datos de ejemplo y las instrucciones.
 */
import { cached } from '../cache';
import { detectAddressKind } from '../addresses';
import { fetchJson } from '../http';
import { getTokenByAddress, pickPrimaryPair, searchPairs } from './dexscreener';
import { isSupportedChain } from '../chains';
import type { TrendAuthor, TrendItem, TrendTweet, TrendWindow, TrendsResponse } from '@/types/social';

const MINUTES: Record<TrendWindow, number> = { '1h': 60, '6h': 360, '24h': 1440 };
export const isTrendWindow = (v: string): v is TrendWindow => v in MINUTES;
export const isXConfigured = () => Boolean(process.env.X_BEARER_TOKEN);

const QUERY = '(memecoin OR "CA:" OR "contract address" OR "pump.fun" OR "100x gem") -is:retweet';
/** Frescura por ventana: la de 1 h se recalcula cada minuto; las largas, menos seguido (ahorra llamadas a la API). */
export const REFRESH_SECONDS: Record<TrendWindow, number> = { '1h': 60, '6h': 180, '24h': 600 };
const PAGES: Record<TrendWindow, number> = { '1h': 2, '6h': 3, '24h': 3 }; // × 100 tweets por consulta: controla el gasto
const SKIP = new Set(['BTC', 'ETH', 'SOL', 'USD', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'AVAX', 'TRX', 'TON', 'LINK', 'DOT', 'MATIC', 'POL', 'SUI', 'APT', 'NEAR', 'LTC']);

const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const CASH_RE = /\$([A-Za-z][A-Za-z0-9]{1,14})\b/g;

interface RawUser { id: string; username: string; name: string; public_metrics?: { followers_count?: number } }
interface RawTweet {
  id: string;
  author_id?: string;
  text: string;
  lang?: string;
  created_at?: string;
  public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number };
}
interface RawSearch { data?: RawTweet[]; includes?: { users?: RawUser[] }; meta?: { next_token?: string } }
interface Fetched { tweets: RawTweet[]; users: Map<string, RawUser> }

async function fetchTweets(window: TrendWindow): Promise<Fetched> {
  const start = new Date(Date.now() - MINUTES[window] * 60_000 + 15_000).toISOString();
  const out: RawTweet[] = [];
  const users = new Map<string, RawUser>();
  let next: string | undefined;
  for (let page = 0; page < PAGES[window]; page++) {
    const qs = new URLSearchParams({
      query: QUERY, max_results: '100', start_time: start,
      'tweet.fields': 'created_at,lang,public_metrics,author_id', expansions: 'author_id', 'user.fields': 'username,name,public_metrics',
    });
    if (next) qs.set('next_token', next);
    const raw = await fetchJson<RawSearch>(`https://api.x.com/2/tweets/search/recent?${qs.toString()}`, {
      revalidate: 30, timeoutMs: 10_000, headers: { authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
    });
    out.push(...(raw.data ?? []));
    for (const u of raw.includes?.users ?? []) users.set(u.id, u);
    next = raw.meta?.next_token;
    if (!next) break;
  }
  return { tweets: out, users };
}

interface Agg {
  key: string; symbol: string; address: string | null;
  mentions: number; recent: number; engagement: number; top: TrendTweet | null; topScore: number;
  voices: Map<string, TrendAuthor>;
}

function aggregate({ tweets, users }: Fetched, window: TrendWindow): Agg[] {
  const mid = Date.now() - (MINUTES[window] * 60_000) / 2;
  const map = new Map<string, Agg>();
  const add = (key: string, symbol: string, address: string | null, t: RawTweet) => {
    const m = t.public_metrics ?? {};
    const likes = m.like_count ?? 0, reposts = (m.retweet_count ?? 0) + (m.quote_count ?? 0), replies = m.reply_count ?? 0;
    const score = likes + reposts + replies;
    const u = t.author_id ? users.get(t.author_id) : undefined;
    const author: TrendAuthor | null = u ? { username: u.username, name: u.name, followers: u.public_metrics?.followers_count ?? 0, url: `https://x.com/${u.username}` } : null;
    const a = map.get(key) ?? { key, symbol, address, mentions: 0, recent: 0, engagement: 0, top: null, topScore: -1, voices: new Map<string, TrendAuthor>() };
    if (author) a.voices.set(author.username, author);
    a.mentions += 1;
    if (t.created_at && Date.parse(t.created_at) >= mid) a.recent += 1;
    a.engagement += score;
    if (score > a.topScore) {
      a.topScore = score;
      a.top = { id: t.id, author, text: t.text, lang: t.lang ?? 'und', likes, reposts, replies, url: author ? `https://x.com/${author.username}/status/${t.id}` : `https://x.com/i/web/status/${t.id}` };
    }
    if (address && !a.address) a.address = address;
    map.set(key, a);
  };

  for (const t of tweets) {
    const addrs = new Set<string>();
    for (const m of t.text.match(EVM_RE) ?? []) addrs.add(m);
    for (const m of t.text.match(SOL_RE) ?? []) if (detectAddressKind(m) === 'solana') addrs.add(m);
    const tickers = [...new Set([...t.text.matchAll(CASH_RE)].map((m) => m[1].toUpperCase()).filter((s) => !SKIP.has(s)))];

    if (addrs.size) {
      // Un tweet con contrato cuenta para ese contrato (y no suma aparte el ticker, para no duplicar).
      for (const a of addrs) add(`ca:${detectAddressKind(a) === 'evm' ? a.toLowerCase() : a}`, tickers[0] ?? a.slice(0, 4), a, t);
    } else {
      for (const s of tickers) add(`tk:${s}`, s, null, t);
    }
  }
  return [...map.values()].filter((a) => a.mentions >= 2).sort((a, b) => b.mentions - a.mentions).slice(0, 30);
}

async function enrich(a: Agg): Promise<TrendItem> {
  const older = a.mentions - a.recent;
  const base: TrendItem = {
    key: a.key, symbol: a.symbol, name: null, chain: null, address: a.address,
    mentions: a.mentions, recentMentions: a.recent, momentum: (a.recent + 1) / (older + 1),
    engagement: a.engagement, indexed: false, liquidityUsd: 0, priceUsd: null, change24h: null, topTweet: a.top,
    projectX: null, voices: [...a.voices.values()].sort((x, y) => y.followers - x.followers).slice(0, 5),
  };
  try {
    const pair = a.address
      ? pickPrimaryPair((await getTokenByAddress(a.address)).filter((p) => isSupportedChain(p.chainId)))
      : (await searchPairs(a.symbol))
          .filter((p) => isSupportedChain(p.chainId) && p.baseToken.symbol.toUpperCase() === a.symbol)
          .sort((x, y) => y.liquidityUsd - x.liquidityUsd)[0] ?? null;
    if (!pair) return base;
    return {
      ...base,
      symbol: pair.baseToken.symbol, name: pair.baseToken.name, chain: pair.chainId, address: pair.baseToken.address,
      projectX: pair.socials.find((l) => l.type === 'twitter')?.url ?? null,
      indexed: pair.liquidityUsd >= 1_000, liquidityUsd: pair.liquidityUsd, priceUsd: pair.priceUsd, change24h: pair.priceChange.h24,
    };
  } catch {
    return base;
  }
}

export async function getTrends(window: TrendWindow): Promise<TrendsResponse> {
  const refreshSeconds = REFRESH_SECONDS[window];
  if (!isXConfigured()) return { configured: false, window, items: [], updatedAt: Date.now(), refreshSeconds };
  const { items, at } = await cached(`social:x:${window}`, refreshSeconds * 1_000, async () => {
    const fetched = await fetchTweets(window);
    const settled = await Promise.allSettled(aggregate(fetched, window).map(enrich));
    return { items: settled.filter((r): r is PromiseFulfilledResult<TrendItem> => r.status === 'fulfilled').map((r) => r.value), at: Date.now() };
  }, 10 * 60_000);
  return { configured: true, window, items, updatedAt: at, refreshSeconds };
}
