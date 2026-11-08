import 'server-only';
import { cached } from '../cache';
import { cacheSafeAddress } from '../addresses';
import { isSupportedChain } from '../chains';
import { buildVerdict, type Lookalike, type TeamReport } from '../team';
import { hostOf, normName, extractXHandle } from '../xhandle';
import { searchPairs } from './dexscreener';
import { getUserInfo, searchTweets } from './xapi';
import type { Token } from '@/types/token';

const SIX_HOURS = 6 * 3_600_000;
const DAY = 86_400_000;
/** Hosts que no cuentan como "sitio del proyecto" al comparar con el perfil de X. */
const GENERIC_HOSTS = new Set(['x.com', 'twitter.com', 't.me', 'discord.gg', 'discord.com', 'dexscreener.com', 'pump.fun', 'linktr.ee']);

const ageDaysOf = (ts: number | null) => (ts ? Math.max(0, Math.floor((Date.now() - ts) / DAY)) : null);

/** Tokens con el mismo nombre o símbolo en cualquier red soportada (posibles imitaciones u originales). */
async function findLookalikes(token: Token): Promise<Lookalike[]> {
  const sym = normName(token.symbol);
  const nm = normName(token.name);
  const queries = [token.symbol, ...(nm.length >= 3 && nm !== sym ? [token.name] : [])];
  const settled = await Promise.allSettled(queries.map((q) => searchPairs(q)));
  const pairs = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const similar = (symbol: string, name: string) => {
    const ps = normName(symbol);
    const pn = normName(name);
    return ps === sym || pn === nm || (nm.length >= 4 && pn.length >= 4 && (pn.startsWith(nm) || nm.startsWith(pn)));
  };

  const self = `${token.chain}:${cacheSafeAddress(token.address)}`;
  const best = new Map<string, (typeof pairs)[number]>();
  for (const p of pairs) {
    if (!isSupportedChain(p.chainId) || p.liquidityUsd < 1_000) continue;
    const key = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
    if (key === self || !similar(p.baseToken.symbol, p.baseToken.name)) continue;
    const prev = best.get(key);
    if (!prev || p.liquidityUsd > prev.liquidityUsd) best.set(key, p);
  }
  return [...best.values()]
    .map((p): Lookalike => ({
      chain: p.chainId,
      address: p.baseToken.address,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      liquidityUsd: p.liquidityUsd,
      ageDays: ageDaysOf(p.pairCreatedAt),
      hasSocials: p.websites.length + p.socials.length > 0,
    }))
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
    .slice(0, 8);
}

/** Cuenta de X del token: existe, qué antigüedad tiene, si publicó este contrato y si enlaza al mismo sitio. */
async function checkX(token: Token, handle: string, isTweetLink: boolean, websiteHosts: string[]): Promise<NonNullable<TeamReport['x']>> {
  const base = { handle, isTweetLink, found: null as boolean | null, name: null as string | null, followers: null as number | null, createdAt: null as string | null, ageDays: null as number | null, verified: false, bio: null as string | null, mentionsContract: null as boolean | null, websiteMatch: null as boolean | null };

  // En serie (no en paralelo): con poco saldo, twitterapi.io limita a 1 consulta cada 5 s.
  try {
    const u = await getUserInfo(handle);
    if (!u) { base.found = false; return base; }
    const created = Date.parse(u.createdAt);
    base.found = true;
    base.name = u.name;
    base.followers = u.followers;
    base.createdAt = Number.isFinite(created) ? new Date(created).toISOString() : null;
    base.ageDays = Number.isFinite(created) ? ageDaysOf(created) : null;
    base.verified = u.isBlueVerified;
    base.bio = u.description ? u.description.slice(0, 280) : null;
    if (websiteHosts.length > 0) {
      const profileHosts = new Set([...u.urls.map(hostOf), ...(u.description.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? []).map((h) => h.toLowerCase())].filter((h): h is string => !!h));
      base.websiteMatch = websiteHosts.some((h) => profileHosts.has(h));
    }
  } catch {
    return base; // sin datos de X: el resto del informe sigue
  }

  try {
    const r = await searchTweets(`from:${handle} "${token.address}"`);
    const needle = token.address.toLowerCase();
    base.mentionsContract = r.tweets.some((t) => (t.text ?? '').toLowerCase().includes(needle));
  } catch {
    base.mentionsContract = null;
  }
  return base;
}

/**
 * Informe "¿Quién está detrás?". Cache de 6 horas por token para cuidar el costo de twitterapi.io
 * (≈ 0,0003 USD por informe: un perfil + una búsqueda).
 */
export function getTeamReport(token: Token): Promise<TeamReport> {
  return cached(`team:${token.chain}:${cacheSafeAddress(token.address)}`, SIX_HOURS, async (): Promise<TeamReport> => {
    const xref = extractXHandle(token.links);
    const website = token.links.find((l) => l.type === 'website')?.url ?? null;
    const websiteHosts = token.links
      .filter((l) => l.type === 'website')
      .map((l) => hostOf(l.url))
      .filter((h): h is string => !!h && !GENERIC_HOSTS.has(h));
    const xAvailable = Boolean(process.env.TWITTERAPI_IO_KEY);

    const [x, lookalikes] = await Promise.all([
      xref && xAvailable ? checkX(token, xref.handle, xref.isTweetLink, websiteHosts) : Promise.resolve<TeamReport['x']>(
        xref ? { handle: xref.handle, isTweetLink: xref.isTweetLink, found: null, name: null, followers: null, createdAt: null, ageDays: null, verified: false, bio: null, mentionsContract: null, websiteMatch: null } : null,
      ),
      findLookalikes(token).catch(() => [] as Lookalike[]),
    ]);

    const thisAge = ageDaysOf(token.pair.pairCreatedAt);
    const creator = token.security?.creator ? { address: token.security.creator, holdingPct: token.security.creatorHoldingPct } : null;
    const everyone = [{ liquidityUsd: token.pair.liquidityUsd, ageDays: thisAge }, ...lookalikes];
    const rank = (cmp: (a: (typeof everyone)[number], b: (typeof everyone)[number]) => number) => [...everyone].sort(cmp).findIndex((e) => e === everyone[0]) + 1;

    const v = buildVerdict({ hasWebsite: !!website, x, xAvailable, creator, lookalikes, thisLiquidity: token.pair.liquidityUsd, thisAgeDays: thisAge });
    return {
      ...v,
      x,
      website,
      creator,
      lookalikes,
      thisRank: lookalikes.length > 0
        ? { byLiquidity: rank((a, b) => b.liquidityUsd - a.liquidityUsd), byAge: rank((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0)), total: everyone.length }
        : null,
      xAvailable,
      generatedAt: Date.now(),
    };
  });
}
