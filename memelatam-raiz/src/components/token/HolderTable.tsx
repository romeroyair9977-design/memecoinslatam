import { AlertTriangle } from 'lucide-react';
import type { HolderStats } from '@/types/token';
import { explorerUrl } from '@/lib/chains';
import { cn, shortAddress } from '@/lib/utils';

export function HolderTable({ stats, chain }: { stats: HolderStats | null; chain: string }) {
  if (!stats || stats.top10Pct === null) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
        No hay datos de holders para este token todavía. Revisa el explorador antes de decidir.
      </p>
    );
  }
  const top10 = stats.top10Pct;
  const tone = top10 > 70 ? 'bg-rose-500' : top10 > 50 ? 'bg-orange-500' : top10 > 30 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Concentración del top 10</span>
          <span className="text-lg font-semibold">{top10.toFixed(1)}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel2" role="img" aria-label={`El top 10 de holders tiene ${top10.toFixed(1)}% del supply`}>
          <div className={cn('h-full', tone)} style={{ width: `${Math.min(100, top10)}%` }} />
        </div>
        {top10 > 50 && (
          <p role="alert" className="mt-3 flex gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Concentración alta: pocos wallets controlan buena parte del supply. Verifica si incluye el pool de liquidez.
          </p>
        )}
      </div>

      {stats.holders.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-muted">
              <tr><th className="p-2 font-medium">#</th><th className="p-2 font-medium">Wallet</th><th className="p-2 text-right font-medium">% supply</th></tr>
            </thead>
            <tbody>
              {stats.holders.slice(0, 10).map((h, i) => {
                const url = explorerUrl(chain, h.address);
                return (
                  <tr key={h.address} className="border-t border-line">
                    <td className="p-2 text-muted">{i + 1}</td>
                    <td className="p-2">
                      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{shortAddress(h.address, 5)}</a> : shortAddress(h.address, 5)}
                      {h.isInsider && <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-300">insider</span>}
                    </td>
                    <td className="p-2 text-right">{h.pct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Fuente: {stats.source === 'rugcheck' ? 'RugCheck' : 'GeckoTerminal'}. La lista puede incluir el pool de liquidez.
      </p>
    </div>
  );
}
