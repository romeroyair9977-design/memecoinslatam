'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

// El gráfico usa canvas y window: solo se carga en el navegador.
const LiveChart = dynamic(() => import('./LiveChart'), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse bg-panel" aria-hidden />,
});

interface Props { chain: string; pairAddress: string; tokenAddress: string; symbol: string }

/** Pestañas: gráfico propio en vivo (por defecto) o el embed de DexScreener (respaldo). */
export function ChartPanel({ chain, pairAddress, tokenAddress, symbol }: Props) {
  const [mode, setMode] = useState<'live' | 'dex'>('live');
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => { setFailed(true); setMode('dex'); }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Tipo de gráfico">
        {(['live', 'dex'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('rounded-md px-3 py-1 text-sm font-medium', mode === m ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}
          >
            {m === 'live' ? 'En vivo' : 'DexScreener'}
          </button>
        ))}
        {failed && <span className="ml-2 text-xs text-amber-300">No pudimos cargar las velas en vivo; mostramos DexScreener.</span>}
      </div>
      {mode === 'live' && !failed ? (
        <LiveChart chain={chain} pairAddress={pairAddress} tokenAddress={tokenAddress} onFail={onFail} />
      ) : (
        <iframe
          title={`Gráfico de ${symbol}`}
          src={`https://dexscreener.com/${chain}/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
          className="h-[420px] w-full bg-panel"
          loading="lazy"
        />
      )}
    </div>
  );
}
