'use client';

import type { ReactNode } from 'react';
import { Age } from '@/components/live/Age';
import { LiveValue } from '@/components/live/LiveValue';
import { useNow } from '@/lib/hooks/live';
import { cn } from '@/lib/utils';
import { useLiveMarket } from './LiveTokenProvider';

/** Precio grande + variación 24 h + indicador "En vivo". */
export function LivePrice() {
  const { market, live, lastOkAt } = useLiveMarket();
  const now = useNow(1000);
  const secs = now ? Math.max(0, Math.round((now - lastOkAt) / 1000)) : null;
  return (
    <div className="text-right">
      <p className="text-2xl font-semibold sm:text-3xl"><LiveValue value={market.priceUsd} kind="price" /></p>
      <p className="text-sm font-medium">
        <LiveValue value={market.change.h24} kind="pct" signed /> <span className="font-normal text-muted">en 24h</span>
      </p>
      <p role="status" className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted">
        <span className={cn('h-2 w-2 rounded-full', live ? 'animate-pulse bg-emerald-400' : 'bg-amber-400')} aria-hidden />
        {live ? 'En vivo' : 'Reconectando…'}
        {live && secs !== null ? ` · hace ${secs} s` : ''}
      </p>
    </div>
  );
}

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{children}</dd>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const WINDOWS = [
  { id: 'm5', label: '5 min' },
  { id: 'h1', label: '1 h' },
  { id: 'h6', label: '6 h' },
  { id: 'h24', label: '24 h' },
] as const;

/** Variaciones por ventana + tarjetas de mercado, todas en vivo. */
export function LiveStats({ dex, totalHolders }: { dex: string; totalHolders: number | null }) {
  const { market } = useLiveMarket();
  const total = market.buys24h + market.sells24h;
  const buyPct = total > 0 ? (market.buys24h / total) * 100 : 50;
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Variación de precio">
        {WINDOWS.map((w) => (
          <li key={w.id} className="rounded-full border border-line bg-panel px-3 py-1">
            <span className="mr-1.5 text-muted">{w.label}</span>
            <LiveValue value={market.change[w.id]} kind="pct" signed />
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Market cap" hint={market.marketCap ? undefined : 'FDV (sin MC informado)'}>
          <LiveValue value={market.marketCap || market.fdv} kind="usd" />
        </Stat>
        <Stat label="Liquidez"><LiveValue value={market.liquidityUsd} kind="usd" /></Stat>
        <Stat label="Volumen 24h"><LiveValue value={market.volume24h} kind="usd" /></Stat>
        <Stat label="Edad del pool"><Age ts={market.pairCreatedAt} /></Stat>
        <Stat label="Compras 24h"><LiveValue value={market.buys24h} kind="int" /></Stat>
        <Stat label="Ventas 24h"><LiveValue value={market.sells24h} kind="int" /></Stat>
        <Stat label="Holders">{totalHolders !== null ? totalHolders.toLocaleString('en-US') : '—'}</Stat>
        <Stat label="DEX">{dex}</Stat>
      </dl>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted"><span>Compras {buyPct.toFixed(0)}%</span><span>Ventas {(100 - buyPct).toFixed(0)}%</span></div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-rose-400/60" role="img" aria-label={`Compras ${buyPct.toFixed(0)} por ciento, ventas ${(100 - buyPct).toFixed(0)} por ciento en 24 horas`}>
          <div className="bg-emerald-400 transition-all duration-700" style={{ width: `${buyPct}%` }} />
        </div>
      </div>
    </div>
  );
}
