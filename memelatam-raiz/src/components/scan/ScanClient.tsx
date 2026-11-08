'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Age } from '@/components/live/Age';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { CYCLE_LABEL, type CycleNum, type Odds } from '@/lib/cycles';
import { usePolling } from '@/lib/hooks/live';
import { cn, formatPct, formatUsd } from '@/lib/utils';
import type { ScanBoard, ScanItem } from '@/types/market';

const TABS: { id: Exclude<CycleNum, 0>; label: string }[] = [
  { id: 3, label: 'Ciclo 3 · 30+ días' },
  { id: 2, label: 'Ciclo 2 · 7 a 30 días' },
  { id: 1, label: 'Ciclo 1 · 1 a 7 días' },
];

const ODDS_CLS: Record<Odds, string> = {
  alta: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  media: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  baja: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

function Row({ t, rank }: { t: ScanItem; rank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-line">
        <td className="p-2 text-muted">{rank}</td>
        <td className="p-2">
          <Link href={`/token/${t.address}?chain=${t.chain}`} className="flex items-center gap-2 hover:text-brand">
            <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={28} />
            <span className="font-medium">{t.symbol}</span>
            <span className="hidden text-xs text-muted sm:inline">{chainLabel(t.chain)}</span>
          </Link>
        </td>
        <td className="p-2 text-muted"><Age ts={t.pairCreatedAt} /></td>
        <td className="p-2 text-right">{formatUsd(t.marketCap)}</td>
        <td className="p-2 text-right">{formatUsd(t.liquidityUsd)}</td>
        <td className="p-2 text-right">{formatUsd(t.volume24h)}</td>
        <td className={cn('p-2 text-right', t.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(t.change24h)}</td>
        <td className="p-2 text-right text-muted">{t.top10Pct !== null ? `${t.top10Pct.toFixed(0)}%` : '—'}</td>
        <td className="p-2">
          {t.odds ? (
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', ODDS_CLS[t.odds])}>
              {t.odds === 'alta' ? 'Opción alta' : t.odds === 'media' ? 'Opción media' : 'Opción baja'}
            </button>
          ) : <span className="text-xs text-muted">Ciclo máximo</span>}
        </td>
      </tr>
      {open && t.reasons.length > 0 && (
        <tr className="bg-bg">
          <td colSpan={9} className="p-3">
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {t.reasons.map((r) => (
                <li key={r.text} className={r.good ? 'text-emerald-300' : 'text-rose-300'}>{r.good ? '+ ' : '- '}{r.text}</li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

export function ScanClient() {
  const [board, setBoard] = useState<ScanBoard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [tab, setTab] = useState<Exclude<CycleNum, 0>>(1);
  const [onlyLow, setOnlyLow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scan', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setBoard((await res.json()) as ScanBoard);
      setStatus('ok');
    } catch {
      setStatus((s) => (s === 'ok' ? s : 'error'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  usePolling(load, 60_000);

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, low1: 0 };
    for (const t of board?.items ?? []) {
      if (t.cycle === 0) continue;
      c[t.cycle] += 1;
      if (t.cycle === 1 && t.odds === 'baja') c.low1 += 1;
    }
    return c;
  }, [board]);

  const rows = useMemo(() => (board?.items ?? []).filter((t) => t.cycle === tab && (!onlyLow || t.odds === 'baja')), [board, tab, onlyLow]);

  if (status === 'loading') return <div className="h-64 animate-pulse rounded-xl border border-line bg-panel" aria-hidden />;
  if (status === 'error' || !board) return <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No pudimos cargar el ranking ahora. Se reintenta solo cada minuto.</p>;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Ciclo" className="flex flex-wrap gap-1 rounded-lg bg-panel p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t.id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}>
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {tab === 1 && counts[1] > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/50 p-3 text-sm">
          <p className="flex-1 basis-60">
            De las {counts[1]} memecoins del Ciclo 1, <strong className="text-rose-300">{counts.low1} tienen opción baja</strong> de llegar al Ciclo 2: casi seguro se apagan antes de cumplir 7 días.
          </p>
          <button aria-pressed={onlyLow} onClick={() => setOnlyLow((v) => !v)} className={cn('rounded-full border px-3 py-1', onlyLow ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : 'border-line text-muted hover:text-ink')}>
            Solo opción baja
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Ninguna memecoin en este filtro ahora mismo.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{CYCLE_LABEL[tab]}</caption>
            <thead className="bg-panel text-left text-muted">
              <tr>
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">Token</th>
                <th className="p-2 font-medium">Edad</th>
                <th className="p-2 text-right font-medium">MC</th>
                <th className="p-2 text-right font-medium">Liquidez</th>
                <th className="p-2 text-right font-medium">Vol 24h</th>
                <th className="p-2 text-right font-medium">24h</th>
                <th className="p-2 text-right font-medium">Top 10</th>
                <th className="p-2 font-medium">{tab === 3 ? 'Estado' : `Llegar al ciclo ${tab + 1}`}</th>
              </tr>
            </thead>
            <tbody>{rows.map((t, i) => <Row key={`${t.chain}:${t.address}`} t={t} rank={i + 1} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
