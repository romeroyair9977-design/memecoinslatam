'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Age } from '@/components/live/Age';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { usePolling } from '@/lib/hooks/live';
import { MOMENTUM_LABEL, fomoLabel, type MomentumState } from '@/lib/momentum';
import { cn, formatPct, formatUsd } from '@/lib/utils';
import type { FomoBoard, FomoItem } from '@/types/market';

const STATE_CLS: Record<MomentumState, string> = {
  acelerando: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  sostenido: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  enfriandose: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  colapsando: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

type Filters = { solana: boolean; base: boolean; ai: boolean; team: boolean; fresh: boolean; clean: boolean };
const FILTERS: { id: keyof Filters; label: string }[] = [
  { id: 'solana', label: 'Solo Solana' },
  { id: 'base', label: 'Solo Base' },
  { id: 'ai', label: 'Solo agentes de IA' },
  { id: 'team', label: 'Con cuenta de X' },
  { id: 'fresh', label: 'Nuevas (menos de 24 h)' },
  { id: 'clean', label: 'Ocultar sospechosas' },
];

function Row({ t, rank }: { t: FomoItem; rank: number }) {
  const team = t.hasX && t.hasWebsite ? 'X y sitio web' : t.hasX ? 'Solo X' : t.hasWebsite ? 'Solo sitio web' : 'Sin redes';
  return (
    <li className="rounded-xl border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="w-6 text-center text-sm text-muted">{rank}</span>
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={40} />
        <div className="min-w-0 flex-1 basis-44">
          <p className="truncate font-medium">{t.symbol} <span className="text-sm font-normal text-muted">{t.name}</span></p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{chainLabel(t.chain)} · {t.dex} · <Age ts={t.pairCreatedAt} /></span>
            {t.ai && <span className="rounded border border-brand/40 px-1 text-brand">posible IA</span>}
            {t.suspicious && <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1 text-rose-300">posible manipulación</span>}
            <span className={cn('rounded border px-1', t.hasX ? 'border-emerald-500/30 text-emerald-300' : 'border-line')}>{team}</span>
          </p>
        </div>

        <div className="w-40">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">FOMO</span>
            <span><strong className="text-base text-ink">{t.fomo}</strong>/100 · {fomoLabel(t.fomo)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel2" role="img" aria-label={`FOMO ${t.fomo} de 100`}>
            <div className="h-full bg-brand transition-all duration-700" style={{ width: `${t.fomo}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-4 gap-x-4 text-center text-xs">
          <div><dt className="text-muted">Compras/min</dt><dd className="text-base font-semibold">{t.buysPerMin.toFixed(1)}</dd></div>
          <div><dt className="text-muted">Ritmo</dt><dd className="text-base font-semibold">{t.accel >= 10 ? '10+' : t.accel.toFixed(1)}×</dd></div>
          <div><dt className="text-muted">% compras</dt><dd className="text-base font-semibold">{Math.round(t.buyShare5 * 100)}%</dd></div>
          <div><dt className="text-muted">5 min</dt><dd className={cn('text-base font-semibold', t.change5m >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(t.change5m, 0)}</dd></div>
        </dl>

        <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
          <span className={cn('rounded-full border px-2.5 py-0.5 font-medium', STATE_CLS[t.state])}>{MOMENTUM_LABEL[t.state]}</span>
          <span className="text-muted">MC {formatUsd(t.marketCap)} · Liq. {formatUsd(t.liquidityUsd)}</span>
        </div>
        <Link href={`/token/${t.address}?chain=${t.chain}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">Analizar</Link>
      </div>
      {t.suspicious && t.flags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-xs text-rose-300">
          {t.flags.map((f) => <li key={f}>- {f}</li>)}
        </ul>
      )}
    </li>
  );
}

export function FomoClient() {
  const [board, setBoard] = useState<FomoBoard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [filters, setFilters] = useState<Filters>({ solana: false, base: false, ai: false, team: false, fresh: false, clean: false });
  const [sort, setSort] = useState<'fomo' | 'quality'>('fomo');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fomo', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setBoard((await res.json()) as FomoBoard);
      setStatus('ok');
    } catch {
      setStatus((s) => (s === 'ok' ? s : 'error'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  usePolling(load, 10_000);

  const items = useMemo(() => {
    const chains = [filters.solana && 'solana', filters.base && 'base'].filter(Boolean) as string[];
    const now = Date.now();
    return (board?.items ?? [])
      .filter((t) => (chains.length === 0 || chains.includes(t.chain)) && (!filters.ai || t.ai) && (!filters.team || t.hasX) && (!filters.clean || !t.suspicious) && (!filters.fresh || (t.pairCreatedAt !== null && now - t.pairCreatedAt < 86_400_000)))
      .sort((a, b) => (sort === 'fomo' ? (b.suspicious ? b.fomo * 0.5 : b.fomo) - (a.suspicious ? a.fomo * 0.5 : a.fomo) : b.quality - a.quality))
      .slice(0, 60);
  }, [board, filters, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Orden" className="flex gap-1 rounded-lg bg-panel p-1">
          {([['fomo', 'Más FOMO'], ['quality', 'Mejor calidad']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={sort === id} onClick={() => setSort(id)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', sort === id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
          {FILTERS.map((f) => (
            <button key={f.id} aria-pressed={filters[f.id]} onClick={() => setFilters((s) => ({ ...s, [f.id]: !s[f.id] }))} className={cn('rounded-full border px-3 py-1 text-sm', filters[f.id] ? 'border-brand/60 bg-panel2 text-ink' : 'border-line text-muted hover:text-ink')}>{f.label}</button>
          ))}
        </div>
      </div>

      {status === 'ok' && board && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          En vivo · se actualiza cada 10 s · {board.scanned} memecoins vigiladas · {items.length} en pantalla
        </p>
      )}

      {status === 'loading' && <ul className="space-y-2" aria-hidden>{[0, 1, 2, 3].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl border border-line bg-panel" />)}</ul>}
      {status === 'error' && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No pudimos cargar el ranking de FOMO ahora. Se reintenta solo cada 10 segundos.</p>}
      {status === 'ok' && items.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Ninguna memecoin cumple estos filtros ahora mismo. Prueba quitar alguno.</p>}
      {status === 'ok' && items.length > 0 && <ol className="space-y-2">{items.map((t, i) => <Row key={`${t.chain}:${t.address}`} t={t} rank={i + 1} />)}</ol>}
    </div>
  );
}
