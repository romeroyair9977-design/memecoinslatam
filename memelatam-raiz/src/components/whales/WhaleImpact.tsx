import { explorerUrl } from '@/lib/chains';
import { formatUsd, shortAddress } from '@/lib/utils';
import type { WhaleHolder, WhaleScenario } from '@/lib/whales';

interface Props { chain: string; whales: WhaleHolder[]; scenarios: WhaleScenario[] }

/** Ballenas de un token + qué pasaría con el precio si venden. Sin hooks: sirve en servidor y en el navegador. */
export function WhaleImpact({ chain, whales, scenarios }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="p-2 font-medium">Ballena</th>
              <th className="p-2 font-medium">Wallet</th>
              <th className="p-2 text-right font-medium">% del supply</th>
              <th className="p-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w, i) => {
              const url = explorerUrl(chain, w.address);
              return (
                <tr key={w.address} className="border-t border-line">
                  <td className="p-2 text-muted">#{i + 1}</td>
                  <td className="p-2">
                    {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{shortAddress(w.address, 5)}</a> : shortAddress(w.address, 5)}
                    {w.isInsider && <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-300">insider</span>}
                  </td>
                  <td className="p-2 text-right">{w.pct.toFixed(2)}%</td>
                  <td className="p-2 text-right font-medium">{formatUsd(w.usd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="p-2 font-medium">Si pasa esto…</th>
              <th className="p-2 text-right font-medium">Venden</th>
              <th className="p-2 font-medium">Caída estimada del precio</th>
              <th className="p-2 text-right font-medium">Dinero que sacarían</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.whales} className="border-t border-line">
                <td className="p-2">{s.label}</td>
                <td className="p-2 text-right">{formatUsd(s.sellUsd)} <span className="text-muted">({s.sellPct.toFixed(1)}%)</span></td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel2" aria-hidden>
                      <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, s.priceDropPct)}%` }} />
                    </div>
                    <span className="font-medium text-rose-300">-{s.priceDropPct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="p-2 text-right">{formatUsd(s.proceedsUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Estimación con un modelo de pool de producto constante: el valor de cada ballena es su % del supply por el market cap, y la caída depende de la liquidez del pool. No incluye liquidez concentrada, ventas escalonadas, compradores que entren ni tokens bloqueados o quemados. Úsalo para comparar fragilidad entre tokens, no como cifra exacta.
      </p>
    </div>
  );
}
