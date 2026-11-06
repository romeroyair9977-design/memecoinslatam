import { detectAddressKind } from './addresses';

export interface Mention { term: string; kind: 'cashtag' | 'address' }

/** Monedas grandes que no son el objetivo: evitan que $BTC o $SOL dominen el ranking de memecoins. */
const IGNORE = new Set([
  'btc', 'eth', 'sol', 'usdt', 'usdc', 'bnb', 'xrp', 'ada', 'dot', 'avax', 'matic', 'link', 'ltc', 'trx', 'ton',
  'sui', 'usd', 'eur', 'dai', 'weth', 'wsol', 'cop', 'mxn', 'ars', 'brl',
]);

const CASHTAG_RE = /(?:^|[^A-Za-z0-9_$])\$([A-Za-z][A-Za-z0-9]{1,14})(?![A-Za-z0-9_])/g;
const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOLANA_RE = /(?:^|[^A-Za-z0-9])([1-9A-HJ-NP-Za-km-z]{32,44})(?![A-Za-z0-9])/g;

/**
 * Saca de un tweet los tokens mencionados: contract addresses (EVM y Solana) y cashtags.
 * Máximo 5 por tweet: un tweet-spam con 40 cashtags no puede inflar 40 tokens a la vez.
 */
export function extractMentions(text: string): Mention[] {
  const out = new Map<string, Mention>();

  for (const m of text.matchAll(EVM_RE)) {
    const term = m[0].toLowerCase();
    out.set(term, { term, kind: 'address' });
  }
  for (const m of text.matchAll(SOLANA_RE)) {
    if (detectAddressKind(m[1]) === 'solana') out.set(m[1], { term: m[1], kind: 'address' });
  }
  for (const m of text.matchAll(CASHTAG_RE)) {
    const sym = m[1].toLowerCase();
    if (IGNORE.has(sym) || /^\d+$/.test(sym)) continue;
    const term = `$${sym}`;
    out.set(term, { term, kind: 'cashtag' });
  }
  return [...out.values()].slice(0, 5);
}

/** Valida un término recibido por URL (evita consultas raras a la base de datos). */
export function isValidTerm(term: string): boolean {
  return /^\$[a-z][a-z0-9]{1,14}$/.test(term) || detectAddressKind(term) !== null;
}

/** Nombres de usuario de X: 1–15 letras, números o guion bajo. */
export const isXUser = (u: string) => /^[A-Za-z0-9_]{1,15}$/.test(u);

/**
 * Consultas de búsqueda en X. Se acotan con min_faves y since_time/until_time para pagar solo por tweets relevantes
 * (twitterapi.io cobra por tweet devuelto). Edítalas aquí sin tocar el resto del código.
 */
export const X_QUERIES = [
  '(memecoin OR memecoins OR pumpfun OR "pump.fun") -is:retweet min_faves:2',
  '(dexscreener OR "contract address") (solana OR base) -is:retweet min_faves:2',
  '(memecoin OR gema OR "moneda meme") (solana OR base) lang:es -is:retweet',
] as const;
