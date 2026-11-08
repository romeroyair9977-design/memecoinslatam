'use client';

import { LiveValue } from '@/components/live/LiveValue';
import { MULTIPLES, buyCapitalNeeded, type Multiple } from '@/lib/potential';
import { cn, formatUsd } from '@/lib/utils';
import type { PotentialCall } from '@/types/market';
import { useLiveMarket } from './LiveTokenProvider';

interface Props {
  symbol: string;
  score: number;
  tier: Multiple | null;
  reasons: string[];
  calls: PotentialCall[];
}

const STATUS = { open: 'en juego', hit: 'cumplido', missed: 'fallado' } as const;

/** Escenarios x10 / x100 / x1000 con el market cap que haría falta y el dinero de compra necesario (modelo). */
export function PotentialCard({ symbol, score, tier, reasons, calls }: Props) {
  const { market } = useLiveMarket();
  const mc = market.marketCap || market.fdv;

  return (
    <section className="rounded-xl border border-line bg-panel/50 p-4">
      <h2 className="mb-1 font-display text-lg font-semibold">Potencial de {symbol}</h2>
      <p className="mb-3 text-sm text-muted">
        {tier
          ? <>Veltrix lo ve como escenario <strong className="text-brand">x{tier}</strong> (nota {score}/100).</>
          : <>No cumple los criterios de un llamado de Veltrix (nota {score}/100).</>}
        {' '}Es un escenario, no una promesa.
      </p>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="p-2 font-medium">Meta</th>
              <th className="p-2 text-right font-medium">Market cap necesario</th>
              <th className="p-2 text-right font-medium">Compra neta necesaria (modelo)</th>
            </tr>
          </thead>
          <tbody>
            {MULTIPLES.map((m) => (
              <tr key={m} className={cn('border-t border-line', tier === m && 'bg-panel2')}>
                <td className="p-2 font-medium">x{m}</td>
                <td className="p-2 text-right"><LiveValue value={mc * m} kind="usd" /></td>
                <td className="p-2 text-right"><LiveValue value={buyCapitalNeeded(market.liquidityUsd, m)} kind="usd" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {reasons.map((r) => <li key={r} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{r}</li>)}
        </ul>
      )}
      {calls.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {calls.map((c) => (
            <li key={c.id} className="text-muted">
              Llamado de Veltrix x{c.multiple} desde {formatUsd(c.entry_mc)}: <span className={c.status === 'hit' ? 'text-emerald-300' : c.status === 'missed' ? 'text-rose-300' : 'text-sky-300'}>{STATUS[c.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        La compra neta es lo que habría que meter al pool para mover el precio ese múltiplo con la liquidez de hoy (pool de producto constante). Sirve para ver qué metas son realistas; en la práctica la liquidez cambia y también habrá ventas.
      </p>
    </section>
  );
}
