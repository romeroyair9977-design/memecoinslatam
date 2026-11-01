'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { DASHBOARD_POLL_MS } from '@/lib/config';
import { activeFilterCount, buildColumns, COLUMN_META, COLUMN_ORDER, DEFAULT_FILTERS, type DashFilters } from '@/lib/filters';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatAge } from '@/lib/utils';
import { tokenKey } from '@/types/community';
import type { Dashboard } from '@/types/token';
import { FiltersPanel } from './FiltersPanel';
import { TokenColumn } from './TokenColumn';
import { TrendingStrip } from './TrendingStrip';

const STORAGE_KEY = 'memelatam:filters:v1';
const FRESH_MS = 45_000; // cuánto tiempo se resalta una memecoin recién aparecida

const keyOf = (t: { chain: string; address: string }) => `${t.chain}:${t.address}`;

/** Une lo guardado con los defaults para que agregar campos nuevos en el futuro no rompa filtros viejos. */
function loadFilters(): DashFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const p = JSON.parse(raw) as Partial<DashFilters>;
    return {
      chain: typeof p.chain === 'string' ? p.chain : 'all',
      columns: {
        nuevas: { ...DEFAULT_FILTERS.columns.nuevas, ...p.columns?.nuevas },
        traccion: { ...DEFAULT_FILTERS.columns.traccion, ...p.columns?.traccion },
        migrando: { ...DEFAULT_FILTERS.columns.migrando, ...p.columns?.migrando },
      },
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

interface Props {
  initial: Dashboard | null;
  memberCounts?: Record<string, number>;
  /** token_key → $LATAM en boosts vigentes (se refresca solo junto con el dashboard). */
  boosts?: Record<string, number>;
}

export function LiveDashboard({ initial, memberCounts, boosts: initialBoosts }: Props) {
  const [data, setData] = useState<Dashboard | null>(initial);
  const [filters, setFilters] = useState<DashFilters>(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [boosts, setBoosts] = useState<Record<string, number>>(initialBoosts ?? {});
  // Reloj para la edad de los tokens. Empieza en la hora del servidor (mismo HTML al hidratar) y luego usa la real.
  const [now, setNow] = useState(initial?.updatedAt ?? 0);
  const known = useRef<Set<string>>(new Set((initial?.tokens ?? []).map(keyOf)));
  const freshTimer = useRef<ReturnType<typeof setTimeout>>();

  // Filtros guardados (se leen tras montar para no romper la hidratación).
  useEffect(() => { setFilters(loadFilters()); }, []);
  const updateFilters = useCallback((f: DashFilters) => {
    setFilters(f);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* modo privado: se ignora */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as Dashboard;
      const arrived = next.tokens.filter((t) => !known.current.has(keyOf(t))).map(keyOf);
      next.tokens.forEach((t) => known.current.add(keyOf(t)));
      if (arrived.length && known.current.size > arrived.length) {
        setFresh(new Set(arrived));
        clearTimeout(freshTimer.current);
        freshTimer.current = setTimeout(() => setFresh(new Set()), FRESH_MS);
      }
      setData(next);
      setNow(Date.now());
      setFailed(false);
      // Boosts vigentes (lectura pública de la vista `active_boosts`).
      const sb = getBrowserSupabase();
      if (sb) {
        const { data: b } = await sb.from('active_boosts').select('token_key, total');
        if (b) setBoosts(Object.fromEntries(b.map((r: { token_key: string; total: number }) => [r.token_key, r.total])));
      }
    } catch {
      setFailed(true); // se conserva lo último que se vio
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-actualización: cada 30 s mientras la pestaña esté visible, y al volver a ella.
  useEffect(() => {
    if (!initial) void refresh(); // la carga inicial falló en el servidor: reintenta ya
    const poll = setInterval(() => { if (!document.hidden) void refresh(); }, DASHBOARD_POLL_MS);
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll); clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(freshTimer.current);
    };
  }, [initial, refresh]);

  // Los tokens con boost suben al inicio de su columna (a más $LATAM, más arriba). sort() es estable: el resto no cambia.
  const columns = useMemo(() => {
    if (!data) return { nuevas: [], traccion: [], migrando: [] };
    const cols = buildColumns(data.tokens, filters, now);
    const weight = (t: { chain: string; address: string }) => boosts[tokenKey(t.chain, t.address)] ?? 0;
    return {
      nuevas: [...cols.nuevas].sort((a, b) => weight(b) - weight(a)),
      traccion: [...cols.traccion].sort((a, b) => weight(b) - weight(a)),
      migrando: [...cols.migrando].sort((a, b) => weight(b) - weight(a)),
    };
  }, [data, filters, now, boosts]);

  const modified =
    (filters.chain !== 'all' ? 1 : 0) +
    COLUMN_ORDER.reduce((n, id) => n + activeFilterCount(filters.columns[id], DEFAULT_FILTERS.columns[id]), 0);

  return (
    <div className="space-y-6">
      {data && <TrendingStrip tokens={data.trending} />}

      <section id="dashboard" className="scroll-mt-20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" suppressHydrationWarning className="flex items-center gap-2 text-sm text-muted">
            <span className={`h-2 w-2 rounded-full ${failed ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} aria-hidden />
            {failed
              ? 'No pudimos actualizar. Mostrando lo último que cargó.'
              : data ? `En vivo · actualizado ${formatAge(data.updatedAt)}` : 'Cargando memecoins…'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Actualizar
            </button>
            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros
              {modified > 0 && <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-bg">{modified}</span>}
            </button>
          </div>
        </div>

        {!data && !loading && failed && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            No pudimos cargar el dashboard (las APIs de datos no respondieron). Reintentamos solos cada 30 s.
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {COLUMN_ORDER.map((id) => (
            <TokenColumn
              key={id}
              column={id}
              title={COLUMN_META[id].title}
              description={COLUMN_META[id].description}
              tokens={columns[id]}
              freshKeys={fresh}
              memberCounts={memberCounts}
              boosts={boosts}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Clasificación heurística con datos de DexScreener, GeckoTerminal y RugCheck. No es asesoría financiera.</p>
      </section>

      {panelOpen && <FiltersPanel filters={filters} onChange={updateFilters} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
