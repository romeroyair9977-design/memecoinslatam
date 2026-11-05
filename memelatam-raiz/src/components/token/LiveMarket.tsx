'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Pair } from '@/types/token';
import { cn, formatAge, formatNumber, formatPct, formatPrice, formatUsd } from '@/lib/utils';

const PairCtx = createContext<Pair | null>(null);

/** Mantiene el par al día: pide datos nuevos cada 5 s (solo con la pestaña visible). */
export function LiveMarketProvider({ initial, chain, token, children }: { initial: Pair; chain: string; token: string; children: React.ReactNode }) {
  const [pair, setPair] = useState<Pair>(initial);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const qs = new URLSearchParams({ chain, token, pool: initial.pairAddress });
        const res = await fetch(`/api/pair?${qs.toString()}`);
        if (!res.ok) return;
        const next = (await res.json()) as Pair;
        if (alive) setPair(next);
      } catch { /* se queda el dato anterior */ }
    };
    const id = setInterval(() => void tick(), 5_000);
    return () => { alive = false; clearInterval(id); };
  }, [chain, token, initial.pairAddress]);
  return <PairCtx.Provider value={pair}>{children}</PairCtx.Provider>;
}

const usePair = () => {
  const p = useContext(PairCtx);
  if (!p) throw new Error('LiveMarketProvider falta');
  return p;
};

/** Precio y cambio 24 h; el número parpadea verde/rojo al subir o bajar. */
export function LivePrice() {
  const p = usePair();
  const prev = useRef(p.priceUsd);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (p.priceUsd !== prev.current) {
      setFlash(p.priceUsd > prev.current ? 'up' : 'down');
      prev.current = p.priceUsd;
      const t = setTimeout(() => setFlash(null), 700);
      return () => clearTimeout(t);
    }
  }, [p.priceUsd]);
  const up = p.priceChange.h24 >= 0;
  return (
    <div className="text-right">
      <p className={cn('rounded px-1 text-2xl font-semibold transition-colors duration-500', flash === 'up' && 'bg-emerald-500/25 text-emerald-300', flash === 'down' && 'bg-rose-500/25 text-rose-300')}>{formatPrice(p.priceUsd)}</p>
      <p className={cn('text-sm font-medium', up ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(p.priceChange.h24)} en 24h</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function LiveStats({ totalHolders }: { totalHolders: number | null }) {
  const pair = usePair();
  const { buys, sells } = pair.txns.h24;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Market cap" value={formatUsd(pair.marketCap || pair.fdv)} hint={pair.marketCap ? undefined : 'FDV (sin MC informado)'} />
      <Stat label="Liquidez" value={formatUsd(pair.liquidityUsd)} />
      <Stat label="Volumen 24h" value={formatUsd(pair.volume.h24)} />
      <Stat label="Edad del pool" value={formatAge(pair.pairCreatedAt)} />
      <Stat label="Compras 24h" value={formatNumber(buys)} />
      <Stat label="Ventas 24h" value={formatNumber(sells)} />
      <Stat label="Holders" value={totalHolders !== null ? formatNumber(totalHolders) : '—'} />
      <Stat label="DEX" value={pair.dexId} />
    </dl>
  );
}
