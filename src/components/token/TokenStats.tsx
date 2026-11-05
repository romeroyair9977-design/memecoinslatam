import type { Pair } from '@/types/token';
import { formatAge, formatNumber, formatUsd } from '@/lib/utils';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TokenStats({ pair, totalHolders }: { pair: Pair; totalHolders: number | null }) {
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
