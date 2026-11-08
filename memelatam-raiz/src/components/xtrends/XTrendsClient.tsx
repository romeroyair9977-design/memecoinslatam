'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '@/lib/hooks/live';
import { cn, formatAge } from '@/lib/utils';
import type { XTrendsResult } from '@/types/xtrends';
import { XTrendRow } from './XTrendRow';

const WINDOWS = [
  { id: 1, label: '1 hora' },
  { id: 6, label: '6 horas' },
  { id: 24, label: '24 horas' },
] as const;

type Filters = { solana: boolean; base: boolean; liquidity: boolean; hot: boolean };
const FILTER_LABELS: { id: keyof Filters; label: string }[] = [
  { id: 'solana', label: 'Solo Solana' },
  { id: 'base', label: 'Solo Base' },
  { id: 'liquidity', label: 'Solo con liquidez' },
  { id: 'hot', label: 'Solo momentum alto' },
];
const MIN_LIQUIDITY = 5_000;

export function XTrendsClient() {
  const [hours, setHours] = useState<1 | 6 | 24>(24);
  const [filters, setFilters] = useState<Filters>({ solana: false, base: false, liquidity: false, hot: false });
  const [data, setData] = useState<XTrendsResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'not_configured'>('loading');

  const asked = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (fresh = false) => {
    try {
      const res = await fetch(`/api/x-trends?hours=${hours}${fresh ? `&fresh=1&_=${Date.now()}` : ''}`, { cache: 'no-store' });
      if (res.status === 503) return setStatus('not_configured');
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as XTrendsResult);
      setStatus('ok');
    } catch {
      setStatus((s) => (s === 'ok' ? s : 'error')); // si ya había datos, se conservan
    }
  }, [hours]);

  useEffect(() => { setStatus('loading'); void load(); }, [load]);
  usePolling(load, 60_000);

  // Si los datos de X tienen más de 30 min (o nunca se escaneó), la página pide una actualización. El servidor la limita
  // a 1 cada 10 min para todos los visitantes juntos, así que no depende de ningún cron externo ni gasta de más.
  useEffect(() => {
    if (status !== 'ok' || !data || asked.current) return;
    const last = data.lastScanAt ? Date.parse(data.lastScanAt) : 0;
    if (Date.now() - last < 30 * 60_000) return;
    asked.current = true;
    setRefreshing(true);
    fetch('/api/x-trends/refresh', { method: 'POST' })
      .then(() => load(true))
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [status, data, load]);

  const items = useMemo(() => {
    if (!data) return [];
    const chains = [filters.solana && 'solana', filters.base && 'base'].filter(Boolean) as string[];
    return data.items.filter((i) => {
      if (chains.length > 0 && !chains.includes(i.token.chain)) return false;
      if (filters.liquidity && i.token.liquidityUsd < MIN_LIQUIDITY) return false;
      if (filters.hot && !(i.momentum >= 1.5 && i.mentions >= 5)) return false;
      return true;
    });
  }, [data, filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Ventana de tiempo" className="flex gap-1 rounded-lg bg-panel p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={hours === w.id}
              onClick={() => setHours(w.id)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium', hours === w.id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
          {FILTER_LABELS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filters[f.id]}
              onClick={() => setFilters((s) => ({ ...s, [f.id]: !s[f.id] }))}
              className={cn('rounded-full border px-3 py-1 text-sm', filters[f.id] ? 'border-brand/60 bg-panel2 text-ink' : 'border-line text-muted hover:text-ink')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'ok' && data && (
        <p className="text-xs text-muted" suppressHydrationWarning>
          {data.lastScanAt ? `Datos de X actualizados ${formatAge(Date.parse(data.lastScanAt))}` : 'Aún no se ha escaneado X'} · {items.length} de {data.items.length} tokens{refreshing ? ' · actualizando datos de X…' : ''}
        </p>
      )}

      {status === 'loading' && (
        <ul className="space-y-2" aria-hidden>{[0, 1, 2, 3].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl border border-line bg-panel" />)}</ul>
      )}
      {status === 'not_configured' && (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Esta sección se activa al conectar Supabase y configurar el escaneo de X (ver README).</p>
      )}
      {status === 'error' && (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No pudimos cargar las tendencias ahora. Se reintenta solo cada minuto.</p>
      )}
      {status === 'ok' && data && data.items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          {refreshing
            ? 'Actualizando los datos de X… esto tarda unos segundos.'
            : data.lastScanAt
              ? 'Todavía no hay suficientes menciones en esta ventana. Prueba con 6 o 24 horas: el ranking se llena a medida que pasan los escaneos.'
              : 'Aún no hay datos de X. La primera actualización se hace sola al abrir esta página; si sigue vacío, revisa /api/x-trends/status.'}
        </p>
      )}
      {status === 'ok' && data && data.items.length > 0 && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Ningún token cumple estos filtros. Prueba quitar alguno.</p>
      )}
      {status === 'ok' && items.length > 0 && (
        <ol className="space-y-2">
          {items.map((it, i) => <XTrendRow key={it.term} item={it} rank={i + 1} hours={hours} />)}
        </ol>
      )}
    </div>
  );
}
