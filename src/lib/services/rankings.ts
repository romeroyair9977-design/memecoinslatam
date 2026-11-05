import 'server-only';
import { cached } from '../cache';
import { getDashboard } from './dashboard';
import type { TokenSummary } from '@/types/token';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Stablecoins, wrappers y majors: no son memecoins y ensucian los rankings. */
const NOT_MEME = new Set(['USDC', 'USDT', 'DAI', 'USDE', 'USDS', 'PYUSD', 'FDUSD', 'SOL', 'WSOL', 'ETH', 'WETH', 'BTC', 'WBTC', 'CBBTC', 'BNB', 'WBNB', 'JITOSOL', 'MSOL', 'JUPSOL', 'BSOL', 'CBETH', 'STETH', 'WSTETH', 'EURC']);
export const looksLikeMeme = (t: TokenSummary) => !NOT_MEME.has(t.symbol.toUpperCase()) && t.marketCap < 3_000_000_000;

export interface RankingEntry { token: TokenSummary; note: string }
export interface Rankings {
  sonadas: RankingEntry[];
  volumen: RankingEntry[];
  fomo: RankingEntry[];
  clasicas: RankingEntry[];
  updatedAt: number;
}

const ageMs = (t: TokenSummary, now: number) => (t.pairCreatedAt ? now - t.pairCreatedAt : Infinity);
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(Math.round(n)));

/**
 * Cuatro rankings sobre los tokens del dashboard (que ya incluye nuevas, en tendencia y con volumen):
 *  - Más sonadas:   mezcla de volumen reciente (1 h pesa x4, 6 h x1) y boosts → lo que más se mueve AHORA.
 *  - Más volumen:   volumen 24 h.
 *  - FOMO nuevas:   ≤ 48 h de vida, más compras que ventas y con volumen: presión compradora en lo recién lanzado.
 *  - Clásicas:      ≥ 14 días de vida con volumen sostenido. Se fija 1 hora (las viejas no cambian cada minuto).
 */
export async function getRankings(): Promise<Rankings> {
  const dash = await getDashboard();
  const now = Date.now();
  const memes = dash.tokens.filter(looksLikeMeme);
  const top = (list: TokenSummary[], n = 15) => list.slice(0, n);

  const sonadas = top([...memes].filter((t) => t.liquidityUsd >= 5_000).sort((a, b) => b.trendScore - a.trendScore))
    .map((t) => ({ token: t, note: `Vol 24h $${fmt(t.volume24h)}` }));

  const volumen = top([...memes].sort((a, b) => b.volume24h - a.volume24h))
    .map((t) => ({ token: t, note: `${fmt(t.txns24h)} transacciones` }));

  const fomo = top(
    memes
      .filter((t) => ageMs(t, now) <= 2 * DAY && t.liquidityUsd >= 5_000 && t.volume24h >= 5_000 && t.buys24h > t.sells24h)
      .map((t) => ({ t, score: (t.buys24h / (t.sells24h + 1)) * Math.log10(t.volume24h) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t),
  ).map((t) => ({ token: t, note: `${t.buys24h} compras vs ${t.sells24h} ventas` }));

  // Las clásicas se congelan 1 hora: así la lista no baila y el contenido "viejo" se queda más tiempo.
  const hourBucket = Math.floor(now / HOUR);
  const clasicas = await cached(`rank:clasicas:${hourBucket}`, HOUR, async () =>
    top(memes.filter((t) => ageMs(t, now) >= 14 * DAY && t.liquidityUsd >= 20_000).sort((a, b) => b.volume24h - a.volume24h))
      .map((t) => ({ token: t, note: `${Math.floor(ageMs(t, now) / DAY)} días de vida` })));

  return { sonadas, volumen, fomo, clasicas, updatedAt: dash.updatedAt };
}
