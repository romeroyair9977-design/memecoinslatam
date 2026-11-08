'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Age } from '@/components/live/Age';
import { LiveValue } from '@/components/live/LiveValue';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { cacheSafeAddress } from '@/lib/addresses';
import { usePolling } from '@/lib/hooks/live';
import { MULTIPLES, buyCapitalNeeded, type Multiple } from '@/lib/potential';
import { cn, formatUsd } from '@/lib/utils';
import type { LiveMarket } from '@/types/token';
import type { PotentialCall } from '@/types/market';

const STATUS_CLS = {
  open: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  hit: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  missed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
} as const;
const STATUS_LABEL = { open: 'En juego', hit: 'Cumplido', missed: 'Fallado' } as const;

function CallCard({ c, live }: { c: PotentialCall; live?: LiveMarket }) {
  const price = live?.priceUsd ?? 0;
  const current = c.status === 'open' ? (price > 0 ? price / c.entry_price : 1) : c.peak_multiple;
  const progress = Math.min(1, Math.max(0, Math.log(Math.max(current, 1)) / Math.log(c.multiple)));
  const liquidity = live?.liquidityUsd ?? 0;
  const remaining = c.multiple / Math.max(current, 1);
  const capital = c.status === 'open' && liquidity > 0 ? buyCapitalNeeded(liquidity, remaining) : 0;

  return (
    <li className="rounded-xl border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <TokenAvatar src={c.image} symbol={c.symbol} size={40} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-medium">{c.symbol} <span className="text-sm font-normal text-muted">{c.name}</span></p>
          <p className="text-xs text-muted">{chainLabel(c.chain)} · llamado <Age ts={Date.parse(c.created_at)} /></p>
        </div>
        <dl className="grid grid-cols-3 gap-x-5 text-center text-xs">
          <div><dt className="text-muted">Entró en</dt><dd className="text-base font-semibold">{formatUsd(c.entry_mc)}</dd></div>
          <div><dt className="text-muted">Meta x{c.multiple}</dt><dd className="text-base font-semibold">{formatUsd(c.target_mc)}</dd></div>
          <div><dt className="text-muted">{c.status === 'open' ? 'Va en' : 'Pico'}</dt><dd className="text-base font-semibold">{c.status === 'open' && price > 0 ? <>x<LiveValue value={Number(current.toFixed(2))} kind="int" /></> : `x${current.toFixed(2)}`}</dd></div>
        </dl>
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_CLS[c.status])}>{STATUS_LABEL[c.status]}</span>
        <Link href={`/token/${c.address}?chain=${c.chain}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">Analizar</Link>
      </div>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-panel2" role="img" aria-label={`Avance hacia x${c.multiple}: ${(progress * 100).toFixed(0)} por ciento`}>
          <div className={cn('h-full transition-all duration-700', c.status === 'missed' ? 'bg-rose-400' : 'bg-emerald-400')} style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {c.status === 'open'
            ? <>Vence <Age ts={Date.parse(c.expires_at)} />{capital > 0 && <> · faltan ≈ {formatUsd(capital)} de compra neta para la meta (modelo)</>}</>
            : c.status === 'hit' ? 'La meta se alcanzó.' : 'No llegó a la meta en el plazo, o el token murió.'}
        </p>
        {c.reasons.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {c.reasons.map((r) => <li key={r} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{r}</li>)}
          </ul>
        )}
      </div>
    </li>
  );
}

export function PotentialBoard({ calls }: { calls: PotentialCall[] }) {
  const [tab, setTab] = useState<Multiple>(10);
  const [live, setLive] = useState<Record<string, LiveMarket>>({});
  const openRef = useRef<PotentialCall[]>([]);
  openRef.current = calls.filter((c) => c.status === 'open');

  const refresh = useCallback(async () => {
    const open = openRef.current.slice(0, 90);
    if (open.length === 0) return;
    const t = open.map((c) => `${c.chain}:${c.address}`).sort().join(',');
    const res = await fetch(`/api/prices?t=${encodeURIComponent(t)}`, { cache: 'no-store' });
    if (res.ok) setLive((await res.json()) as Record<string, LiveMarket>);
  }, []);
  usePolling(refresh, 10_000);

  const stats = useMemo(() => {
    const by = (m: Multiple) => {
      const list = calls.filter((c) => c.multiple === m);
      const hit = list.filter((c) => c.status === 'hit').length;
      const missed = list.filter((c) => c.status === 'missed').length;
      return { open: list.filter((c) => c.status === 'open').length, hit, missed, rate: hit + missed > 0 ? Math.round((hit / (hit + missed)) * 100) : null };
    };
    return { 10: by(10), 100: by(100), 1000: by(1000) };
  }, [calls]);

  const list = calls
    .filter((c) => c.multiple === tab)
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || Date.parse(b.created_at) - Date.parse(a.created_at));

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Meta" className="grid grid-cols-3 gap-2">
        {MULTIPLES.map((m) => {
          const s = stats[m];
          return (
            <button key={m} role="tab" aria-selected={tab === m} onClick={() => setTab(m)} className={cn('rounded-xl border p-3 text-left', tab === m ? 'border-brand/60 bg-panel2' : 'border-line bg-panel hover:border-brand/40')}>
              <p className="font-display text-xl font-bold">x{m}</p>
              <p className="text-xs text-muted">{s.open} en juego · {s.hit} cumplidos · {s.missed} fallados</p>
              <p className="text-xs">{s.rate !== null ? <span className="text-emerald-300">{s.rate}% de aciertos</span> : <span className="text-muted">Sin resultados todavía</span>}</p>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          Todavía no hay llamados x{tab}. Veltrix solo publica uno cuando un token cumple todos los criterios, así que puede tardar.
        </p>
      ) : (
        <ul className="space-y-2">{list.map((c) => <CallCard key={c.id} c={c} live={live[`${c.chain}:${cacheSafeAddress(c.address)}`]} />)}</ul>
      )}
    </div>
  );
}
