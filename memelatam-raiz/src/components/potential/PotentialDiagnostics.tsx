'use client';

import { useState, type SyntheticEvent } from 'react';
import { Age } from '@/components/live/Age';
import { cn, formatUsd } from '@/lib/utils';
import type { PotencialDiag } from '@/lib/services/potencial-job';

interface Resp {
  ok: boolean;
  ran?: boolean;
  lastStarted?: string | null;
  lastFinished?: string | null;
  lastError?: string | null;
  details?: PotencialDiag | null;
  hasDetailsColumn?: boolean;
}

/** «¿Por qué no hay llamados?»: muestra cuántas monedas pasan cada filtro en la última corrida. */
export function PotentialDiagnostics() {
  const [data, setData] = useState<Resp | null>(null);
  const [failed, setFailed] = useState(false);

  function onToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || data) return;
    fetch('/api/potencial/diagnostico', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
      .then((d: Resp) => setData(d))
      .catch(() => setFailed(true));
  }

  const d = data?.details ?? null;
  const max = d ? Math.max(1, ...d.funnel.map((f) => f.count)) : 1;

  return (
    <details onToggle={onToggle} className="rounded-xl border border-line bg-panel/50 p-4">
      <summary className="cursor-pointer font-medium">¿Por qué no hay llamados? Ver diagnóstico de la última revisión</summary>
      <div className="mt-4 space-y-4">
        {failed && <p className="text-sm text-muted">No pudimos cargar el diagnóstico ahora.</p>}
        {!data && !failed && <p role="status" className="text-sm text-muted">Cargando…</p>}
        {data && !data.ran && <p className="text-sm text-muted">La tarea todavía no ha corrido. Abre la página de inicio y vuelve en unos 20 segundos.</p>}
        {data?.ran && (
          <p className="text-xs text-muted" suppressHydrationWarning>
            Última revisión: {data.lastFinished ? <Age ts={Date.parse(data.lastFinished)} /> : 'sin terminar'}
            {data.lastError ? ` · error: ${data.lastError}` : ''}
          </p>
        )}
        {data?.ran && !d && (
          <p className="text-sm text-muted">
            {data.hasDetailsColumn === false ? 'Falta ejecutar la migración 0008 en Supabase para guardar el diagnóstico.' : 'La última revisión no dejó diagnóstico (la tarea corrió sin evaluar candidatas). Se genera en la próxima corrida.'}
          </p>
        )}

        {d && (
          <>
            <div>
              <h3 className="mb-2 text-sm font-medium">Embudo: cuántas monedas pasan cada filtro</h3>
              <ol className="space-y-1.5">
                {d.funnel.map((f, i) => (
                  <li key={f.step} className="text-sm">
                    <div className="flex justify-between gap-2"><span>{i + 1}. {f.step}</span><strong>{f.count}</strong></div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-panel2" aria-hidden>
                      <div className={cn('h-full', f.count === 0 ? 'bg-rose-400' : 'bg-brand')} style={{ width: `${Math.max(f.count > 0 ? 3 : 0, (f.count / max) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">Donde el número llega a 0 está el cuello de botella de esta revisión.</p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Las monedas de Solana con más FOMO</h3>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-panel text-left text-muted">
                    <tr><th className="p-2 font-medium">Moneda</th><th className="p-2 text-right font-medium">FOMO</th><th className="p-2 text-right font-medium">MC</th><th className="p-2 text-right font-medium">Edad</th><th className="p-2 font-medium">Resultado</th></tr>
                  </thead>
                  <tbody>
                    {d.candidates.map((c) => (
                      <tr key={c.address} className="border-t border-line">
                        <td className="p-2 font-medium">{c.symbol}</td>
                        <td className="p-2 text-right">{c.fomo}</td>
                        <td className="p-2 text-right">{formatUsd(c.marketCap)}</td>
                        <td className="p-2 text-right text-muted">{c.ageHours === null ? '—' : c.ageHours < 48 ? `${Math.round(c.ageHours)} h` : `${Math.round(c.ageHours / 24)} d`}</td>
                        <td className={cn('p-2', c.verdict === 'publicado' ? 'text-emerald-300' : 'text-muted')}>{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
