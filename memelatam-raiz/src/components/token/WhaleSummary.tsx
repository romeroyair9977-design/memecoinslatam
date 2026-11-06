import type { HolderStats } from '@/types/token';
import { buildWhaleReport, WHALE_PCT } from '@/lib/whales';
import { cn, formatNumber } from '@/lib/utils';

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2/40 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold', tone)}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Resumen rápido para decidir: ¿cuánta gente lo tiene? ¿hay ballenas? ¿hay insiders? */
export function WhaleSummary({ stats }: { stats: HolderStats | null }) {
  const r = buildWhaleReport(stats);
  if (!r || (r.totalHolders === null && r.checked === 0)) return null;
  const hasList = r.checked > 0;
  const whaleTone = !hasList ? undefined : r.whales.length >= 4 ? 'text-orange-300' : r.whales.length > 0 ? 'text-amber-300' : 'text-emerald-300';

  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Personas con el token" value={r.totalHolders !== null ? formatNumber(r.totalHolders) : '—'} hint="Holders totales" />
        <Stat
          label={`Ballenas (≥ ${WHALE_PCT}% del supply)`}
          value={hasList ? String(r.whales.length) : '—'}
          hint={hasList ? (r.whales.length ? `Suman ${r.whalesPct.toFixed(1)}% del supply` : 'Ninguna entre los mayores holders') : 'Solo disponible en Solana'}
          tone={whaleTone}
        />
        <Stat label="Wallet más grande" value={r.top1Pct !== null ? `${r.top1Pct.toFixed(1)}%` : '—'} hint="Sin contar el pool" tone={r.top1Pct !== null && r.top1Pct > 10 ? 'text-orange-300' : undefined} />
        <Stat label="Marcadas como insider" value={hasList ? String(r.insiders) : '—'} hint="Según RugCheck" tone={r.insiders > 0 ? 'text-rose-300' : undefined} />
      </div>
      {hasList && r.whales.length >= 4 && (
        <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
          Hay varias ballenas: si algunas venden a la vez, el precio puede caer rápido. Revisa abajo quiénes son.
        </p>
      )}
      <p className="text-xs text-muted">Se calcula con los {r.checked || 'principales'} mayores holders que reporta la fuente. Una ballena no es buena ni mala por sí sola: es una señal para mirar con cuidado.</p>
    </div>
  );
}
