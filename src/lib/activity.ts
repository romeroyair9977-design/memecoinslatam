import type { Activity, Pair, SocialLink } from '@/types/token';

/**
 * ¿Token "fantasma" o con vida real? Heurística simple sobre actividad de trading y presencia social.
 * (Iteración futura: sumar menciones en X y crecimiento de holders.)
 */
export function computeActivity(pair: Pair, links: SocialLink[]): Activity {
  const tx24 = pair.txns.h24.buys + pair.txns.h24.sells;
  const vol24 = pair.volume.h24;
  const reasons: string[] = [];
  let points = 0;

  if (links.length >= 2) { points += 2; reasons.push('Tiene redes/sitio enlazados'); }
  else if (links.length === 1) { points += 1; reasons.push('Solo una red enlazada'); }
  else reasons.push('Sin redes ni sitio web registrados');

  if (tx24 >= 300) { points += 2; reasons.push(`${tx24} transacciones en 24 h`); }
  else if (tx24 >= 50) { points += 1; reasons.push(`${tx24} transacciones en 24 h`); }
  else reasons.push(`Solo ${tx24} transacciones en 24 h`);

  if (vol24 >= 20_000) points += 1;
  if (pair.boostsActive > 0) { points += 1; reasons.push('Promocionado en DexScreener (boost)'); }

  const status = points >= 4 ? 'activo' : points >= 2 ? 'tibio' : 'fantasma';
  return { status, reasons };
}
