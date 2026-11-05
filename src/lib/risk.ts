import type { HolderStats, Pair, RiskFlag, RiskLevel, RiskScore, SecuritySignals, SocialLink } from '@/types/token';

interface RiskInput {
  pair: Pair;
  holders: HolderStats | null;
  security: SecuritySignals | null;
  links: SocialLink[];
}

const HOUR = 3_600_000;

/**
 * Score heurístico 0–100 (más alto = más riesgo). NO detecta todos los rugs:
 * es una ayuda para priorizar revisión, no una garantía de seguridad.
 */
export function computeRisk({ pair, holders, security, links }: RiskInput): RiskScore {
  const flags: RiskFlag[] = [];
  let score = 0;
  const add = (pts: number, flag: RiskFlag) => { score += pts; flags.push(flag); };

  // Liquidez
  if (pair.liquidityUsd < 5_000)
    add(30, { id: 'liq-low', severity: 'danger', label: 'Liquidez muy baja', detail: 'Menos de $5K: un solo vendedor puede hundir el precio y salir es difícil.' });
  else if (pair.liquidityUsd < 20_000)
    add(15, { id: 'liq-mid', severity: 'warn', label: 'Liquidez baja', detail: 'Entre $5K y $20K: mucha volatilidad y slippage alto.' });

  // Edad
  const age = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null;
  if (age !== null && age < HOUR)
    add(15, { id: 'age-1h', severity: 'warn', label: 'Menos de 1 hora de vida', detail: 'Aún no hay historial para evaluar el comportamiento del dev ni de los holders.' });

  // Concentración de holders
  const top10 = holders?.top10Pct ?? null;
  if (top10 !== null) {
    if (top10 > 70)
      add(30, { id: 'top10-extreme', severity: 'danger', label: `Top 10 controla ${top10.toFixed(0)}%`, detail: 'Concentración extrema: pocos wallets pueden tumbar el precio.' });
    else if (top10 > 50)
      add(18, { id: 'top10-high', severity: 'warn', label: `Top 10 controla ${top10.toFixed(0)}%`, detail: 'Concentración alta. Revisa si incluye el pool/LP o wallets del dev.' });
    else if (top10 < 30)
      add(0, { id: 'top10-ok', severity: 'ok', label: `Top 10 controla ${top10.toFixed(0)}%`, detail: 'Distribución razonablemente repartida.' });
  } else {
    flags.push({ id: 'holders-unknown', severity: 'info', label: 'Holders sin datos', detail: 'No pudimos obtener la distribución de holders de este token.' });
  }
  if ((holders?.top1Pct ?? 0) > 20)
    add(12, { id: 'top1', severity: 'warn', label: `Un wallet tiene ${holders!.top1Pct!.toFixed(0)}%`, detail: 'Puede ser el pool de liquidez; verifica en el explorador.' });

  // Seguridad on-chain (Solana)
  if (security?.rugged)
    add(50, { id: 'rugged', severity: 'danger', label: 'Marcado como RUG', detail: 'RugCheck reporta este token como rugged.' });
  if (security?.mintAuthorityActive)
    add(20, { id: 'mint', severity: 'danger', label: 'Mint authority activa', detail: 'El creador puede emitir más tokens y diluirte.' });
  else if (security && !security.mintAuthorityActive)
    flags.push({ id: 'mint-ok', severity: 'ok', label: 'Mint authority renunciada', detail: 'No se pueden crear más tokens.' });
  if (security?.freezeAuthorityActive)
    add(15, { id: 'freeze', severity: 'danger', label: 'Freeze authority activa', detail: 'El creador puede congelar tu wallet.' });
  for (const [i, r] of (security?.dangerRisks ?? []).slice(0, 3).entries())
    add(5, { id: `rc-${i}`, severity: 'danger', label: 'Alerta de RugCheck', detail: r });

  // Comportamiento de trading
  const { buys, sells } = pair.txns.h24;
  if (buys >= 20 && sells === 0)
    add(25, { id: 'honeypot', severity: 'danger', label: 'Solo compras, cero ventas', detail: 'Posible honeypot: nadie logra vender. No compres sin simular la venta.' });
  if (pair.liquidityUsd > 0 && pair.volume.h24 / pair.liquidityUsd > 50)
    add(8, { id: 'wash', severity: 'warn', label: 'Volumen desproporcionado', detail: 'Volumen 50× mayor que la liquidez: posible wash trading.' });

  // Presencia social
  if (links.length === 0)
    add(10, { id: 'no-socials', severity: 'warn', label: 'Sin redes ni web', detail: 'No hay canales oficiales registrados.' });

  score = Math.min(100, score);
  const level: RiskLevel = score < 25 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'critical';

  // peligros primero
  const order = { danger: 0, warn: 1, info: 2, ok: 3 } as const;
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, level, flags };
}
