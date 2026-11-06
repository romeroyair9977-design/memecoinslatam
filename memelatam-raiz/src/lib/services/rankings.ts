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
export type RankingId = 'vivas' | 'pocaActividad' | 'boom' | 'muertas' | 'sonadas' | 'fomo' | 'volumen' | 'clasicas';
export type Rankings = Record<RankingId, RankingEntry[]> & { updatedAt: number };

const ageMs = (t: TokenSummary, now: number) => (t.pairCreatedAt ? now - t.pairCreatedAt : Infinity);
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(Math.round(n)));
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`;
const LIMIT = 12;

/**
 * Ocho listas sobre los tokens del dashboard. Cada una responde una pregunta distinta antes de decidir:
 *  - vivas:         actividad real (transacciones, redes, volumen) y liquidez ≥ $10K.
 *  - pocaActividad: hay algo de movimiento pero poco; ojo con la liquidez.
 *  - boom:          subió ≥ 100 % en 24 h con volumen y liquidez mínimos (puede ser un pump: revisa holders).
 *  - muertas:       ≥ 12 h de vida y señales de abandono (fantasma, caída ≥ 80 %, o liquidez y volumen casi nulos).
 *  - sonadas:       lo que más se mueve AHORA (volumen 1 h pesa x4, 6 h x1, más boosts).
 *  - fomo:          ≤ 48 h de vida, más compras que ventas y con volumen.
 *  - volumen:       dónde está pasando más dinero en 24 h.
 *  - clasicas:      ≥ 14 días de vida y todavía con volumen. Se congela 1 hora.
 * Son heurísticas para priorizar revisión, no recomendaciones de inversión.
 */
export async function getRankings(): Promise<Rankings> {
  const dash = await getDashboard();
  const now = Date.now();
  const memes = dash.tokens.filter(looksLikeMeme);
  const top = (list: TokenSummary[], n = LIMIT) => list.slice(0, n);
  const by = (f: (t: TokenSummary) => number) => (a: TokenSummary, b: TokenSummary) => f(b) - f(a);

  const vivas = top(memes.filter((t) => t.activity === 'activo' && t.liquidityUsd >= 10_000 && t.volume24h >= 10_000).sort(by((t) => t.volume24h)))
    .map((t) => ({ token: t, note: `${fmt(t.txns24h)} transacciones · liquidez $${fmt(t.liquidityUsd)}` }));

  const pocaActividad = top(memes.filter((t) => t.activity === 'tibio' && t.liquidityUsd >= 5_000).sort(by((t) => t.volume24h)))
    .map((t) => ({ token: t, note: `Solo ${fmt(t.txns24h)} transacciones en 24 h · vol $${fmt(t.volume24h)}` }));

  const boom = top(memes.filter((t) => t.change24h >= 100 && t.volume24h >= 10_000 && t.liquidityUsd >= 5_000).sort(by((t) => t.change24h)))
    .map((t) => ({ token: t, note: `${pct(t.change24h)} en 24 h · vol $${fmt(t.volume24h)}` }));

  const muertas = top(
    memes
      .filter((t) => ageMs(t, now) >= 12 * HOUR)
      .filter((t) => (t.activity === 'fantasma' && t.txns24h < 50) || t.change24h <= -80 || (t.liquidityUsd < 5_000 && t.volume24h < 1_000))
      .sort((a, b) => a.change24h - b.change24h),
  ).map((t) => ({ token: t, note: `${pct(t.change24h)} en 24 h · ${fmt(t.txns24h)} transacciones · liquidez $${fmt(t.liquidityUsd)}` }));

  const sonadas = top(memes.filter((t) => t.liquidityUsd >= 5_000).sort(by((t) => t.trendScore)))
    .map((t) => ({ token: t, note: `Vol 24h $${fmt(t.volume24h)}` }));

  const volumen = top([...memes].sort(by((t) => t.volume24h)))
    .map((t) => ({ token: t, note: `${fmt(t.txns24h)} transacciones` }));

  const fomo = top(
    memes
      .filter((t) => ageMs(t, now) <= 2 * DAY && t.liquidityUsd >= 5_000 && t.volume24h >= 5_000 && t.buys24h > t.sells24h)
      .map((t) => ({ t, score: (t.buys24h / (t.sells24h + 1)) * Math.log10(t.volume24h) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t),
  ).map((t) => ({ token: t, note: `${t.buys24h} compras vs ${t.sells24h} ventas` }));

  // Las clásicas se congelan 1 hora: así la lista no baila.
  const hourBucket = Math.floor(now / HOUR);
  const clasicas = await cached(`rank:clasicas:${hourBucket}`, HOUR, async () =>
    top(memes.filter((t) => ageMs(t, now) >= 14 * DAY && t.liquidityUsd >= 20_000).sort(by((t) => t.volume24h)))
      .map((t) => ({ token: t, note: `${Math.floor(ageMs(t, now) / DAY)} días de vida` })));

  return { vivas, pocaActividad, boom, muertas, sonadas, fomo, volumen, clasicas, updatedAt: dash.updatedAt };
}
