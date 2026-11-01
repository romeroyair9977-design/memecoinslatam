/**
 * Orquesta todas las fuentes para armar un Token completo:
 * DexScreener (mercado, autodetecta chain) + GeckoTerminal (metadata/holders) + RugCheck (Solana).
 */
import { cached } from '../cache';
import { cacheSafeAddress, detectAddressKind } from '../addresses';
import { isSupportedChain } from '../chains';
import { TTL } from '../config';
import { computeActivity } from '../activity';
import { computeRisk } from '../risk';
import { getTokenByAddress, pickPrimaryPair } from './dexscreener';
import { getGeckoOverview } from './geckoterminal';
import { getRugCheckOverview } from './rugcheck';
import type { HolderStats, Pair, SocialLink, Token, TokenInfo, TokenResult } from '@/types/token';

/** Une links de DexScreener + GeckoTerminal sin duplicados. */
function mergeLinks(pair: Pair, info: TokenInfo | null): SocialLink[] {
  const out: SocialLink[] = [...pair.websites, ...pair.socials];
  if (info) {
    for (const w of info.websites) out.push({ type: 'website', url: w });
    if (info.twitterHandle) out.push({ type: 'twitter', url: `https://x.com/${info.twitterHandle}` });
    if (info.telegramHandle) out.push({ type: 'telegram', url: `https://t.me/${info.telegramHandle}` });
    if (info.discordUrl) out.push({ type: 'discord', url: info.discordUrl });
  }
  const seen = new Set<string>();
  return out.filter((l) => {
    const k = l.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function getTokenFull(address: string, chainHint?: string): Promise<TokenResult> {
  const addr = address.trim();
  if (!detectAddressKind(addr)) return Promise.resolve({ status: 'invalid' });

  return cached(`token:${cacheSafeAddress(addr)}:${chainHint ?? ''}`, TTL.price, async (): Promise<TokenResult> => {
    let pairs: Pair[];
    try {
      pairs = await getTokenByAddress(addr);
    } catch {
      return { status: 'error', message: 'No pudimos consultar DexScreener. Intenta de nuevo en unos segundos.' };
    }
    pairs = pairs.filter((p) => isSupportedChain(p.chainId));
    if (!pairs.length) return { status: 'not_found' };

    // Agrupa por chain y elige la pedida (?chain=) o la de mayor liquidez.
    const byChain = new Map<string, Pair[]>();
    for (const p of pairs) byChain.set(p.chainId, [...(byChain.get(p.chainId) ?? []), p]);
    const ranked = [...byChain.entries()]
      .map(([chain, ps]) => ({ chain, liquidityUsd: Math.max(...ps.map((x) => x.liquidityUsd)) }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    const chain = chainHint && byChain.has(chainHint) ? chainHint : ranked[0].chain;
    const chainPairs = byChain.get(chain)!;
    const pair = pickPrimaryPair(chainPairs)!;

    // Fuentes secundarias en paralelo; si fallan, degradamos sin romper la página.
    const tokenAddress = pair.baseToken.address;
    const [gecko, rug] = await Promise.all([
      getGeckoOverview(chain, tokenAddress),
      chain === 'solana' ? getRugCheckOverview(tokenAddress) : Promise.resolve(null),
    ]);

    // Prioridad de holders: RugCheck (lista de wallets) > GeckoTerminal (solo resumen).
    const holders: HolderStats | null = rug?.holders ?? gecko?.holders ?? null;
    const info = gecko?.info ?? null;
    const security = rug?.security ?? null;
    const links = mergeLinks(pair, info);

    const token: Token = {
      address: tokenAddress,
      chain,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      imageUrl: chainPairs.find((p) => p.imageUrl)?.imageUrl ?? null,
      pair,
      pairs: chainPairs.sort((a, b) => b.liquidityUsd - a.liquidityUsd),
      alternativeChains: ranked.filter((r) => r.chain !== chain),
      holders,
      security,
      info,
      risk: computeRisk({ pair, holders, security, links }),
      activity: computeActivity(pair, links),
      links,
      updatedAt: Date.now(),
    };
    return { status: 'ok', token };
  });
}
