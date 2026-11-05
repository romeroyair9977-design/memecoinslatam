'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CHAINS } from '@/lib/chains';
import { buildColumns, COLUMN_META, COLUMN_ORDER, DEFAULT_FILTERS, type ColumnFilters, type DashFilters } from '@/lib/filters';
import { cn } from '@/lib/utils';
import type { ColumnId, TokenSummary } from '@/types/token';

interface Props {
  /** Filtros ya aplicados al dashboard */
  filters: DashFilters;
  /** Tokens disponibles: sirven para mostrar cuántos resultados daría el borrador antes de aplicarlo. */
  tokens: TokenSummary[];
  /** Se llama SOLO al pulsar "Buscar" (aplica y guarda). */
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

export function FiltersPanel({ filters: applied, tokens, onApply, onClose }: Props) {
  // Borrador: se edita aquí y solo se aplica al pulsar "Buscar" (antes cada tecla cambiaba el dashboard sin avisar y
  // parecía que el botón no hacía nada).
  const [filters, setDraft] = useState<DashFilters>(applied);
  const [tab, setTab] = useState<ColumnId>('nuevas');
  const col = filters.columns[tab];
  const onChange = setDraft;

  // Resultados que daría el borrador (misma lógica que el dashboard, en el navegador y al instante).
  const counts = useMemo(() => {
    const c = buildColumns(tokens, filters);
    return { nuevas: c.nuevas.length, traccion: c.traccion.length, migrando: c.migrando.length };
  }, [tokens, filters]);
  const total = counts.nuevas + counts.traccion + counts.migrando;
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setCol = (patch: Partial<ColumnFilters>) =>
    onChange({ ...filters, columns: { ...filters.columns, [tab]: { ...col, ...patch } } });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filtros avanzados"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-panel p-5 pb-0"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Filtros avanzados</h2>
          <button onClick={onClose} aria-label="Cerrar filtros" className="rounded-md p-1 text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-muted">Red (chain)</span>
          <select
            value={filters.chain}
            onChange={(e) => onChange({ ...filters, chain: e.target.value })}
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
              {COLUMN_META[id].title} <span className="opacity-70">({counts[id]})</span>
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
        <p className="mt-3 text-xs text-muted">Top 10 desconocido (aún sin consultar o fuera de Solana) no se excluye.</p>

        {/* Barra fija abajo: siempre visible, sin tener que bajar el scroll para encontrar el botón. */}
        <div className="sticky -bottom-5 -mx-5 mt-auto space-y-2 border-t border-line bg-panel px-5 pb-5 pt-4">
          <button
            onClick={() => { onApply(filters); onClose(); }}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-bg hover:bg-brand-dim"
          >
            Buscar · {total} {total === 1 ? 'resultado' : 'resultados'}{dirty ? '' : ' (sin cambios)'}
          </button>
          {total === 0 && (
            <p className="text-xs text-amber-300">Con estos filtros no sale ninguna memecoin ahora mismo. Afloja algún límite (liquidez, market cap o edad).</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...filters, columns: { ...filters.columns, [tab]: DEFAULT_FILTERS.columns[tab] } })}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/60"
            >
              Restablecer esta columna
            </button>
            <button onClick={() => onChange(DEFAULT_FILTERS)} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/60">
              Restablecer todo
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
