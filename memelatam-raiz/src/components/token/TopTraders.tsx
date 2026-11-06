'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { FollowWalletButton } from '@/components/profile/ProfileClient';
import { LiveValue } from '@/components/live/LiveValue';
import { explorerUrl } from '@/lib/chains';
import { usePolling } from '@/lib/hooks/live';
import { cn, shortAddress } from '@/lib/utils';
import type { TraderRow } from '@/types/token';

interface Props {
  chain: string;
  pairAddress: string;
  loggedIn: boolean;
  /** Wallets que el usuario ya sigue en esta red. */
  followed: string[];
  /** En modo demo (sin Supabase) no se muestra el botón de seguir. */
  canFollow: boolean;
}

/**
 * Traders más movidos del token: wallets con más volumen en los últimos trades del pool.
 * Es ACTIVIDAD reciente, no ganancias: puede incluir bots y routers. Para ranking por PnL real hace falta Birdeye/Helius.
 */
export function TopTraders({ chain, pairAddress, loggedIn, followed, canFollow }: Props) {
  const [rows, setRows] = useState<TraderRow[] | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/traders?chain=${encodeURIComponent(chain)}&pair=${encodeURIComponent(pairAddress)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setRows(((await res.json()) as { traders: TraderRow[] }).traders);
      setError(false);
    } catch {
      setError(true);
    }
  }, [chain, pairAddress]);

  useEffect(() => { void load(); }, [load]);
  usePolling(load, 30_000);

  async function copy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1500);
    } catch { /* sin permiso de portapapeles: se ignora */ }
  }

  if (rows === null && !error) return <p role="status" className="text-sm text-muted">Buscando a los traders más movidos…</p>;
  if (error && rows === null) return <p className="text-sm text-muted">No pudimos cargar los trades recientes. Se reintenta solo.</p>;
  if (!rows || rows.length === 0) return <p className="text-sm text-muted">Aún no hay trades recientes para analizar.</p>;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="p-2 font-medium">Wallet</th>
              <th className="p-2 text-right font-medium">Trades</th>
              <th className="p-2 text-right font-medium">Compró</th>
              <th className="p-2 text-right font-medium">Vendió</th>
              <th className="p-2 text-right font-medium">Neto</th>
              <th className="p-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const url = explorerUrl(chain, r.address);
              return (
                <tr key={r.address} className="border-t border-line">
                  <td className="p-2">
                    {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{shortAddress(r.address, 5)}</a> : shortAddress(r.address, 5)}
                  </td>
                  <td className="p-2 text-right">{r.trades}</td>
                  <td className="p-2 text-right"><LiveValue value={r.buyUsd} kind="usd" /></td>
                  <td className="p-2 text-right"><LiveValue value={r.sellUsd} kind="usd" /></td>
                  <td className={cn('p-2 text-right font-medium', r.netUsd >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {r.netUsd >= 0 ? '+' : '-'}<LiveValue value={Math.abs(r.netUsd)} kind="usd" />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => void copy(r.address)} aria-label="Copiar dirección" className="rounded border border-line p-1 text-muted hover:text-ink">
                        {copied === r.address ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                      {canFollow && <FollowWalletButton chain={chain} address={r.address} loggedIn={loggedIn} initiallyFollowing={followed.includes(r.address)} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Basado en los últimos trades del pool (DexScreener y GeckoTerminal). Mide actividad, no ganancias, y puede incluir bots y routers. Guarda las wallets que te interesen con Seguir.
      </p>
    </div>
  );
}
