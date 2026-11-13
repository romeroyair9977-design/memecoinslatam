/**
 * Señales de FOMO posiblemente fabricado (bots, volumen inflado). Código puro.
 * Son indicios, no pruebas: una moneda marcada puede ser legítima y una limpia puede estar manipulada.
 * Se usa para BAJAR su posición en el ranking de FOMO y para NO publicar llamados de Potencial sobre ella.
 */
import type { FlowSet } from './momentum';

export interface ManipulationInput {
  flow: FlowSet;
  liquidityUsd: number;
  priceChangeM5: number;
}
export interface ManipulationResult {
  suspicious: boolean;
  flags: string[];
}

export function detectManipulation(i: ManipulationInput): ManipulationResult {
  const { m5 } = i.flow;
  const t5 = m5.buys + m5.sells;
  const flags: string[] = [];
  let weight = 0;

  // Operaciones diminutas: miles de compras de centavos suelen ser bots o volumen falso.
  const avgTrade = t5 > 0 ? m5.volume / t5 : 0;
  if (t5 >= 100 && avgTrade > 0 && avgTrade < 3) {
    flags.push(`Operaciones diminutas (promedio de ${avgTrade.toFixed(1)} USD cada una)`);
    weight += 2;
  }
  // Casi nadie vende: en un mercado real siempre hay ventas (o es una trampa donde no se puede vender).
  if (t5 >= 50 && m5.buys / t5 >= 0.98) {
    flags.push('Casi solo compras y casi ninguna venta');
    weight += 2;
  }
  // Se movió más dinero que la liquidez del pool en solo 5 minutos.
  if (i.liquidityUsd > 0 && m5.volume / i.liquidityUsd >= 1.5) {
    flags.push('En 5 minutos se movió más de 1,5 veces la liquidez del pool');
    weight += 1;
  }
  // Ritmo imposible para personas en un pool chico.
  if (m5.buys / 5 >= 100 && i.liquidityUsd < 50_000) {
    flags.push('Más de 100 compras por minuto en un pool pequeño (ritmo de bots)');
    weight += 1;
  }
  // Muchas compras pero el precio cae: algo no cuadra.
  if (t5 >= 40 && m5.buys / t5 >= 0.75 && i.priceChangeM5 <= -10) {
    flags.push('Muchas compras pero el precio baja');
    weight += 1;
  }
  return { suspicious: weight >= 2, flags };
}
