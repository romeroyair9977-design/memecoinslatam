/**
 * Arma el dashboard: junta candidatos (GeckoTerminal new/trending pools + perfiles/boosts de DexScreener),
 * los enriquece con datos de pares en batch (+ concentración top 10 vía RugCheck en Solana) y devuelve
 * TODOS los tokens resumidos. El reparto en columnas lo hace `buildColumns` (lib/filters.ts) en el cliente,
 * así el panel de filtros avanzados responde al instante sin pedir nada al servidor.
 */
import { cached, withTimeout } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { isSupportedChain } from '../chains';
import { TTL } from '../config';
import { computeActivity } from '../activity';
import { getCandidateRefs, getTokensBatch, pickPrimaryPair, type ProfileRef } from './dexscreener';
import { getNewPoolTokens, getTopVolumeTokens, getTrendingPoolTokens } from './geckoterminal';
import { getRugCheckOverview } from './rugcheck';
import { getBoostedRefs } from './community';
import type { Dashboard, Pair, TokenSummary } from '@/types/token';

const MAX_CANDIDATES = 240;
const SOURCE_TIMEOUT_MS = 3_500; // una fuente lenta no frena a las demás
const MIN_LIQUIDITY = 1_000; // descarta pools vacíos/polvo
const TOP10_MAX_LOOKUPS = 30; // consultas a RugCheck por refresco
const TOP10_BUDGET_MS = 1_200; // RugCheck es lo más lento: NO bloquea la respuesta; lo que falte se completa solo (queda en cache)

async function gatherCandidates(): Promise<ProfileRef[]> {
  const t = (p: Promise<ProfileRef[]>) => withTimeout(p, SOURCE_TIMEOUT_MS, [] as ProfileRef[]);
  const lists = await Promise.all([
    t(getBoostedRefs()), // primero: los tokens con boost siempre entran al dashboard
    t(getNewPoolTokens('solana')),
    t(getNewPoolTokens('base')),
    t(getTrendingPoolTokens('solana')),
    t(getTrendingPoolTokens('base')),
    t(getCandidateRefs()),
    // Tokens ya establecidos con volumen: sin esto, "Migrando" y "Con tracción" casi nunca tendrían candidatos.
    t(getTopVolumeTokens('solana', 1)),
    t(getTopVolumeTokens('solana', 2)),
    t(getTopVolumeTokens('base', 1)),
  ]);
  const all = lists.flat();
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

function oldestPair(pairs: Pair[]): number | null {
  const ts = pairs.map((p) => p.pairCreatedAt).filter((x): x is number => !!x);
  return ts.length ? Math.min(...ts) : null;
}

function summarize(pairs: Pair[]): TokenSummary | null {
  const main = pickPrimaryPair(pairs);
  if (!main || main.liquidityUsd < MIN_LIQUIDITY) return null;
  const links = [...main.websites, ...main.socials];
  const activity = computeActivity(main, links).status;
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
    // Edad = el par MÁS ANTIGUO del token (un token migrado tiene pares nuevos en otro DEX, pero nació antes).
    pairCreatedAt: oldestPair(pairs) ?? main.pairCreatedAt,
    dexId: main.dexId,
    dexCount: new Set(pairs.map((p) => p.dexId)).size,
    top10Pct: null,
    activity,
    trendScore: main.volume.h1 * 4 + main.volume.h6 + main.boostsActive * 5_000,
  };
}

/** Rellena top10Pct (Solana) con presupuesto de tiempo; lo que no llegue queda null y se completa luego. */
async function enrichTop10(tokens: TokenSummary[]): Promise<void> {
  const targets = tokens
    .filter((t) => t.chain === 'solana' && t.liquidityUsd >= 10_000)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, TOP10_MAX_LOOKUPS);

  const work = (async () => {
    let i = 0;
    const worker = async () => {
      while (i < targets.length) {
        const t = targets[i++];
        const o = await withTimeout(getRugCheckOverview(t.address), 8_000, null);
        if (o?.holders.top10Pct != null) t.top10Pct = Math.round(o.holders.top10Pct * 10) / 10;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, TOP10_BUDGET_MS))]);
}

export function getDashboard(): Promise<Dashboard> {
  return cached('dashboard', TTL.dashboard, buildDashboard, TTL.dashboardStale);
}

async function buildDashboard(): Promise<Dashboard> {
  const candidates = await gatherCandidates();

  // Agrupa por chain y consulta en lotes de 30 (límite de DexScreener).
  const byChain = new Map<string, string[]>();
  for (const c of candidates) byChain.set(c.chain, [...(byChain.get(c.chain) ?? []), c.address]);

  const requests: Promise<Pair[]>[] = [];
  for (const [chain, addrs] of byChain)
    for (let i = 0; i < addrs.length; i += 30) requests.push(getTokensBatch(chain, addrs.slice(i, i + 30)));
  const pairs = (await Promise.all(requests.map((r) => withTimeout(r, 5_000, [] as Pair[])))).flat();

  // Agrupa pares por token (chain + address del token base).
  const grouped = new Map<string, Pair[]>();
  for (const p of pairs) {
    const key = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), p]);
  }

  const tokens = [...grouped.values()].map(summarize).filter((s): s is TokenSummary => s !== null);
  await enrichTop10(tokens);

  return {
    tokens,
    trending: [...tokens].filter((t) => t.liquidityUsd >= 5_000).sort((a, b) => b.trendScore - a.trendScore).slice(0, 10),
    updatedAt: Date.now(),
  };
}
