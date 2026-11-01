import type { Category, Pair } from '@/types/token';
import { pickPrimaryPair } from './services/dexscreener';

const HOUR = 3_600_000;
const MIGRATION_DEXES = ['pumpswap', 'raydium', 'meteora'];

/**
 * Clasifica un token (con todos sus pares) en 0..3 categorías del dashboard.
 * Son HEURÍSTICAS ajustables; un token puede caer en más de una (p.ej. nueva + migrando).
 *
 * - new: par creado hace <24 h con al menos $2K de liquidez.
 * - traction: >3 h de vida, liquidez ≥ $25K, volumen 24 h ≥ $50K y ≥ 300 txns.
 * - migrating: DexScreener no expone "graduación" directa, así que inferimos:
 *    (a) existe en ≥2 DEXs y el par más nuevo tiene <72 h, o
 *    (b) par en Pumpswap/Raydium/Meteora de <48 h con market cap ≥ $60K (umbral cercano a la graduación de pump.fun).
 *   Listados en CEX / otras plataformas → fase 2 (CoinGecko /exchanges o scraping de anuncios).
 */
export function classify(pairs: Pair[]): Category[] {
  const main = pickPrimaryPair(pairs);
  if (!main) return [];
  const now = Date.now();
  const age = main.pairCreatedAt ? now - main.pairCreatedAt : Infinity;
  const mc = main.marketCap || main.fdv;
  const tx24 = main.txns.h24.buys + main.txns.h24.sells;
  const tags: Category[] = [];

  if (age < 24 * HOUR && main.liquidityUsd >= 2_000) tags.push('new');

  if (age >= 3 * HOUR && main.liquidityUsd >= 25_000 && main.volume.h24 >= 50_000 && tx24 >= 300)
    tags.push('traction');

  const dexes = new Set(pairs.map((p) => p.dexId));
  const newest = Math.max(...pairs.map((p) => p.pairCreatedAt ?? 0));
  const multiDex = dexes.size >= 2 && newest > 0 && now - newest < 72 * HOUR && mc >= 60_000;
  const graduated =
    MIGRATION_DEXES.includes(main.dexId) && age < 48 * HOUR && mc >= 60_000;
  if (multiDex || graduated) tags.push('migrating');

  return tags;
}
