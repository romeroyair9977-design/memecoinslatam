'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { LIVE_POLL_MS } from '@/lib/config';
import { usePolling } from '@/lib/hooks/live';
import type { LiveMarket } from '@/types/token';

interface Ctx { market: LiveMarket; live: boolean; lastOkAt: number }
const LiveCtx = createContext<Ctx | null>(null);

interface Props { initial: LiveMarket; chain: string; address: string; children: ReactNode }

/** Mantiene el mercado del token abierto actualizado (cada pocos segundos) y lo comparte con precio, stats y gráfico. */
export function LiveTokenProvider({ initial, chain, address, children }: Props) {
  const [market, setMarket] = useState<LiveMarket>(initial);
  const [live, setLive] = useState(true);
  const [lastOkAt, setLastOkAt] = useState(initial.updatedAt);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/token/${encodeURIComponent(address)}/live?chain=${encodeURIComponent(chain)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setMarket((await res.json()) as LiveMarket);
      setLive(true);
      setLastOkAt(Date.now());
    } catch {
      setLive(false); // se conserva el último dato y se reintenta solo
    }
  }, [address, chain]);

  usePolling(poll, LIVE_POLL_MS);
  return <LiveCtx.Provider value={{ market, live, lastOkAt }}>{children}</LiveCtx.Provider>;
}

export function useLiveMarket(): Ctx {
  const c = useContext(LiveCtx);
  if (!c) throw new Error('useLiveMarket debe usarse dentro de LiveTokenProvider');
  return c;
}
