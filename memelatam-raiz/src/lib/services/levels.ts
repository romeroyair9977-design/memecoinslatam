import 'server-only';
import { cached } from '../cache';
import { LEVELS, type LevelData } from '../levels';
import { getCandles } from './chart';

/**
 * Niveles históricos de un token: precio de la primera vela diaria, pico y cuándo tocó x10, x100, x1000…
 * Usa velas diarias de GeckoTerminal (hasta ~3 años), así que el "cuándo" tiene precisión de un día.
 * Devuelve null si la fuente no tiene velas (token muy nuevo o pool no indexado).
 */
export async function getLevelData(chain: string, pair: string, token: string): Promise<LevelData | null> {
  return cached(`levels:${chain}:${pair}`, 10 * 60_000, async () => {
    const candles = await getCandles(chain, pair, token, '1d', 1000);
    if (candles.length === 0 || !(candles[0].open > 0)) return null;
    const launchPrice = candles[0].open;
    const peakPrice = Math.max(...candles.map((c) => c.high));
    const reached = LEVELS.flatMap((level) => {
      const c = candles.find((k) => k.high >= launchPrice * level);
      return c ? [{ level, at: c.time * 1000 }] : [];
    });
    return { launchPrice, peakPrice, firstAt: candles[0].time * 1000, reached };
  }).catch(() => null);
}
