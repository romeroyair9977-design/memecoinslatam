/**
 * Niveles de 10 en 10 desde el primer dato de precio de una memecoin (x10, x100, x1000, x10000). Código puro.
 * "Salió en" es una ESTIMACIÓN: precio de apertura de la primera vela disponible × la cantidad de tokens de hoy.
 */
import type { MomentumState } from './momentum';

export const LEVELS = [10, 100, 1000, 10000] as const;

/** Datos históricos del token (de las velas diarias de GeckoTerminal). */
export interface LevelData {
  launchPrice: number;
  peakPrice: number;
  /** ms de la primera vela */
  firstAt: number;
  /** ms de la vela en que el precio tocó por primera vez cada nivel */
  reached: { level: number; at: number }[];
}

export interface LevelStats {
  currentX: number;
  peakX: number;
  /** caída desde el pico, 0–100 */
  drawdownPct: number;
  nextLevel: number | null;
  launchMc: number;
  peakMc: number;
}

export function levelStats(d: LevelData, price: number, marketCap: number): LevelStats {
  const currentX = d.launchPrice > 0 ? price / d.launchPrice : 0;
  const peakX = d.launchPrice > 0 ? Math.max(d.peakPrice, price) / d.launchPrice : 0;
  const supply = price > 0 ? marketCap / price : 0; // tokens en circulación (aprox.)
  return {
    currentX,
    peakX,
    drawdownPct: d.peakPrice > 0 ? Math.max(0, (1 - price / Math.max(d.peakPrice, price)) * 100) : 0,
    nextLevel: LEVELS.find((l) => l > currentX) ?? null,
    launchMc: d.launchPrice * supply,
    peakMc: Math.max(d.peakPrice, price) * supply,
  };
}

export interface LevelMessage { tone: 'good' | 'warn' | 'bad' | 'info'; text: string }

/**
 * Mensaje según el nivel y el impulso. Son SEÑALES con su explicación, no órdenes ni promesas:
 * una señal de salida llega cuando el precio ya empezó a bajar, nunca antes.
 * `riskReason`: si hay un riesgo grave (mint/freeze activos, top 10 muy concentrado) NO se anima a seguir subiendo.
 */
export function levelMessage(i: { state: MomentumState; currentX: number; peakX: number; nextLevel: number | null; riskReason: string | null }): LevelMessage {
  if (i.riskReason) return { tone: 'bad', text: `Riesgo alto: ${i.riskReason}. No hay señal de "puede seguir subiendo" para este token.` };
  const reachedTen = i.peakX >= 10;
  const next = i.nextLevel ? `x${i.nextLevel.toLocaleString('en-US')}` : 'el siguiente nivel';
  switch (i.state) {
    case 'acelerando':
      return { tone: 'good', text: reachedTen ? `El impulso sigue fuerte. Ya pasó x10: si estás en ganancia, asegurar una parte reduce el riesgo; el resto puede ir hacia ${next}.` : `El impulso sigue fuerte: hay opción de que avance hacia ${next}, sin garantía.` };
    case 'sostenido':
      return { tone: 'info', text: reachedTen ? 'Impulso estable. Ya pasó x10: vigila las ventas y considera asegurar parte de la ganancia.' : 'Impulso estable. Vigila si suben las ventas.' };
    case 'enfriandose':
      return { tone: 'warn', text: 'El FOMO baja y hay más ventas que antes. Si ya estás en ganancia, considera asegurarla; la subida se está apagando.' };
    case 'colapsando':
      return { tone: 'bad', text: 'La presión de venta domina. La subida se está apagando: llegar al siguiente nivel es poco probable ahora.' };
  }
}

/** "150k", "1.5m", "2,500" → número. null si no se entiende. */
export function parseUsd(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = /^(\d*\.?\d+)([kmb]?)$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]) * ({ '': 1, k: 1e3, m: 1e6, b: 1e9 } as const)[m[2] as '' | 'k' | 'm' | 'b'];
  return Number.isFinite(n) && n > 0 ? n : null;
}
