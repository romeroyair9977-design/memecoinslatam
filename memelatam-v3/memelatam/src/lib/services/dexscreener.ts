/**
 * DexScreener (API pública, sin key). Límites aprox.: 300 req/min en endpoints de pairs,
 * 60 req/min en perfiles/boosts. Docs: https://docs.dexscreener.com/api/reference
 */
import { cached, } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { TTL } from '../config';
import { fetchJson } from '../http';
import type { Pair, SocialLink, TimeWindow } from '@/types/token';

const BASE = 'https://api.dexscreener.com';

/* ───────────── Tipos crudos de la API ───────────── */
interface RawTokenRef { address: string; name: string; symbol: string }
interface RawPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: RawTokenRef;
  quoteToken: RawTokenRef;
  priceNative?: string;
  priceUsd?: string;
  txns?: Partial<Record<TimeWindow, { buys: number; sells: number }>>;
  volume?: Partial<Record<TimeWindow, number>>;
  priceChange?: Partial<Record<TimeWindow, number>>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { label?: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
  boosts?: { active?: number };
}

export interface ProfileRef { chain: string; address: string; }
interface RawProfile { chainId: string; tokenAddress: string }

/* ───────────── Normalización ───────────── */
const WINDOWS: TimeWindow[] = ['m5', 'h1', 'h6', 'h24'];

function windowed<T>(src: Partial<Record<TimeWindow, T>> | undefined, fallback: T): Record<TimeWindow, T> {
  return Object.fromEntries(WINDOWS.map((w) => [w, src?.[w] ?? fallback])) as Record<TimeWindow, T>;
}

export function normalizePair(p: RawPair): Pair {
  const websites: SocialLink[] = (p.info?.websites ?? []).map((w) => ({
    type: 'website',
    url: w.url,
    label: w.label,
  }));
  const socials: SocialLink[] = (p.info?.socials ?? []).map((s) => ({ type: s.type, url: s.url }));
  return {
    chainId: p.chainId,
    dexId: p.dexId,
    url: p.url,
    pairAddress: p.pairAddress,
    baseToken: p.baseToken,
    quoteToken: p.quoteToken,
    priceUsd: Number(p.priceUsd ?? 0),
    priceNative: Number(p.priceNative ?? 0),
    txns: windowed(p.txns, { buys: 0, sells: 0 }),
    volume: windowed(p.volume, 0),
    priceChange: windowed(p.priceChange, 0),
    liquidityUsd: p.liquidity?.usd ?? 0,
    fdv: p.fdv ?? 0,
    marketCap: p.marketCap ?? 0,
    pairCreatedAt: p.pairCreatedAt ?? null,
    imageUrl: p.info?.imageUrl ?? null,
    websites,
    socials,
    boostsActive: p.boosts?.active ?? 0,
  };
}

/** Par con más liquidez = el "real" (evita pools falsos o vacíos). */
export function pickPrimaryPair(pairs: Pair[]): Pair | null {
  if (!pairs.length) return null;
  return pairs.reduce((best, p) => (p.liquidityUsd > best.liquidityUsd ? p : best));
}

/* ───────────── Endpoints ───────────── */

/**
 * Busca todos los pares donde el token es base, en TODAS las chains (autodetecta la chain).
 * Devuelve [] si el token no existe o no tiene pools.
 */
export async function getTokenByAddress(address: string): Promise<Pair[]> {
  return cached(`dex:token:${cacheSafeAddress(address)}`, TTL.price, async () => {
    const data = await fetchJson<{ pairs: RawPair[] | null }>(`${BASE}/latest/dex/tokens/${address}`, {
      revalidate: 30,
    });
    const pairs = (data.pairs ?? []).map(normalizePair);
    const wanted = address.toLowerCase();
    const asBase = pairs.filter((p) => p.baseToken.address.toLowerCase() === wanted);
    return asBase.length ? asBase : pairs;
  });
}

/** Hasta 30 tokens de la misma chain por request. */
export async function getTokensBatch(chain: string, addresses: string[]): Promise<Pair[]> {
  if (!addresses.length) return [];
  const list = addresses.slice(0, 30).join(',');
  const raw = await fetchJson<RawPair[]>(`${BASE}/tokens/v1/${chain}/${list}`, { revalidate: 30 });
  return (Array.isArray(raw) ? raw : []).map(normalizePair);
}

/** Búsqueda por nombre/símbolo (para autocompletar en el futuro). */
export async function searchPairs(query: string): Promise<Pair[]> {
  const q = encodeURIComponent(query.trim());
  return cached(`dex:search:${q}`, TTL.price, async () => {
    const data = await fetchJson<{ pairs: RawPair[] | null }>(`${BASE}/latest/dex/search?q=${q}`, {
      revalidate: 30,
    });
    return (data.pairs ?? []).map(normalizePair);
  });
}

/** Tokens con perfil recién creado + tokens con boosts (señal de promoción/atención). */
export async function getCandidateRefs(): Promise<ProfileRef[]> {
  const urls = [
    `${BASE}/token-profiles/latest/v1`,
    `${BASE}/token-boosts/latest/v1`,
    `${BASE}/token-boosts/top/v1`,
  ];
  const results = await Promise.allSettled(urls.map((u) => fetchJson<RawProfile[]>(u, { revalidate: 60 })));
  const refs: ProfileRef[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    for (const item of r.value) refs.push({ chain: item.chainId, address: item.tokenAddress });
  }
  return refs;
}
