'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CHAINS } from '@/lib/chains';
import { buildColumns, COLUMN_META, COLUMN_ORDER, DEFAULT_FILTERS, type ColumnFilters, type DashFilters } from '@/lib/filters';
import { cn } from '@/lib/utils';
import type { ColumnId, TokenSummary } from '@/types/token';

interface Props {
  /** Filtros vigentes (el panel edita una COPIA hasta que se pulsa "Aplicar"). */
  filters: DashFilters;
  /** Tokens ya cargados: sirven para mostrar cuántos cumplen mientras se ajustan los filtros. */
  tokens: TokenSummary[];
  onApply: (f: DashFilters) => void;
  onClose: () => void;
}

type NumKey = Exclude<keyof ColumnFilters, 'needsMigration'>;

const FIELDS: { label: string; unit: string; min?: NumKey; max?: NumKey }[] = [
  { label: 'Edad', unit: 'horas', min: 'ageMinH', max: 'ageMaxH' },
  { label: 'Liquidez', unit: 'USD', min: 'liqMin', max: 'liqMax' },
  { label: 'Market cap', unit: 'USD', min: 'mcMin', max: 'mcMax' },
  { label: 'Volumen 24 h', unit: 'USD', min: 'volMin' },
  { label: 'Compras 24 h', unit: 'txns', min: 'buysMin' },
  { label: 'Ventas 24 h', unit: 'txns', min: 'sellsMin' },
  { label: 'Top 10 holders', unit: '% máx.', max: 'top10Max' },
];

function NumInput({ value, onChange, placeholder, label }: { value: number | null; onChange: (v: number | null) => void; placeholder: string; label: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      aria-label={label}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        const n = raw === '' ? null : Number(raw);
        onChange(n === null || !Number.isFinite(n) || n < 0 ? null : n);
      }}
      className="h-9 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink placeholder:text-muted"
    />
  );
}

export function FiltersPanel({ filters, tokens, onApply, onClose }: Props) {
  const [tab, setTab] = useState<ColumnId>('nuevas');
  const [draft, setDraft] = useState<DashFilters>(filters);
  const col = draft.columns[tab];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Cuántas memecoins cumplen con lo que se está escribiendo (antes de aplicar).
  const preview = useMemo(() => buildColumns(tokens, draft), [tokens, draft]);
  const total = COLUMN_ORDER.reduce((n, id) => n + preview[id].length, 0);

  const setCol = (patch: Partial<ColumnFilters>) =>
    setDraft((d) => ({ ...d, columns: { ...d.columns, [tab]: { ...d.columns[tab], ...patch } } }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filtros avanzados"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-panel"
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-display text-lg font-semibold">Filtros avanzados</h2>
          <button onClick={onClose} aria-label="Cerrar filtros" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-muted">Red (chain)</span>
            <select
              value={draft.chain}
              onChange={(e) => setDraft({ ...draft, chain: e.target.value })}
              className="h-9 w-full rounded-md border border-line bg-bg px-2 text-ink"
            >
              <option value="all">Todas</option>
              {Object.values(CHAINS).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>

          <div role="tablist" aria-label="Columna a editar" className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-bg p-1">
            {COLUMN_ORDER.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn('rounded-md px-2 py-1.5 text-xs font-medium', tab === id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}
              >
                {COLUMN_META[id].title} ({preview[id].length})
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-muted">Estos filtros solo afectan la columna “{COLUMN_META[tab].title}”. Deja vacío = sin límite.</p>

          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{f.label}</span><span className="text-xs text-muted">{f.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {f.min ? <NumInput label={`${f.label} mínimo`} placeholder="Mín." value={col[f.min]} onChange={(v) => setCol({ [f.min!]: v } as Partial<ColumnFilters>)} /> : <span />}
                  {f.max ? <NumInput label={`${f.label} máximo`} placeholder="Máx." value={col[f.max]} onChange={(v) => setCol({ [f.max!]: v } as Partial<ColumnFilters>)} /> : <span />}
                </div>
              </div>
            ))}
            {tab === 'migrando' && (
              <label className="flex items-start gap-2 pt-1 text-sm">
                <input type="checkbox" checked={col.needsMigration} onChange={(e) => setCol({ needsMigration: e.target.checked })} className="mt-1" />
                <span>Solo graduadas o presentes en 2+ DEX<span className="block text-xs text-muted">Pumpswap, Raydium, Meteora o varios exchanges descentralizados.</span></span>
              </label>
            )}
          </div>
          <p className="my-3 text-xs text-muted">Top 10 desconocido (aún sin consultar o fuera de Solana) no se excluye.</p>
        </div>

        {/* Barra fija abajo: siempre visible, sin tener que bajar hasta el final del panel */}
        <div className="space-y-2 border-t border-line bg-panel p-4">
          <p role="status" className="text-center text-sm text-muted">
            {total > 0 ? `${total} memecoins cumplen estos filtros` : 'Ninguna memecoin cumple estos filtros. Prueba aflojar alguno.'}
          </p>
          <button
            onClick={() => onApply(draft)}
            className="h-11 w-full rounded-lg bg-brand text-sm font-semibold text-bg hover:bg-brand-dim"
          >
            Aplicar filtros
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setDraft((d) => ({ ...d, columns: { ...d.columns, [tab]: DEFAULT_FILTERS.columns[tab] } }))}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/60"
            >
              Restablecer esta columna
            </button>
            <button onClick={() => setDraft(DEFAULT_FILTERS)} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/60">
              Restablecer todo
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
