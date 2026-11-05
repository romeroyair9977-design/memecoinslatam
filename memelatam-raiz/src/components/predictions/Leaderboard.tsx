'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CATEGORIES, horizonLabel, type LeaderRow } from '@/lib/predictions';
import { cn } from '@/lib/utils';

const TABS = [{ id: 'all', label: 'Todas' }, ...CATEGORIES] as const;

/** Ranking de aciertos con pestañas por tipo de memecoin (los datos de todas las pestañas llegan ya calculados). */
export function Leaderboard({ boards }: { boards: Record<string, LeaderRow[]> }) {
  const [tab, setTab] = useState<string>('all');
  const rows = boards[tab] ?? [];
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Categoría" className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('shrink-0 rounded-full border px-3 py-1 text-sm', tab === t.id ? 'border-brand/60 bg-panel2 text-ink' : 'border-line text-muted hover:text-ink')}>{t.label}</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Todavía nadie tiene predicciones resueltas en esta categoría. Las primeras se resuelven a los 7 días.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs text-muted">
              <tr><th className="p-2 font-medium">#</th><th className="p-2 font-medium">Predictor</th><th className="p-2 text-right font-medium">Aciertos</th><th className="p-2 text-right font-medium">% acierto</th><th className="hidden p-2 text-right font-medium sm:table-cell">Mayor plazo acertado</th><th className="p-2 text-right font-medium">Ganó</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const total = r.hits + r.misses;
                return (
                  <tr key={r.user_id} className="border-t border-line">
                    <td className="p-2 text-muted">{i + 1}</td>
                    <td className="p-2"><Link href={`/perfil/${r.username}`} className="font-medium hover:text-brand">@{r.username}</Link></td>
                    <td className="p-2 text-right">{r.hits}/{total}</td>
                    <td className="p-2 text-right">{Math.round((r.hits / total) * 100)}%</td>
                    <td className="hidden p-2 text-right text-muted sm:table-cell">{r.best_horizon ? horizonLabel(r.best_horizon) : '—'}</td>
                    <td className="p-2 text-right font-medium text-brand">{r.earned} $LATAM</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
