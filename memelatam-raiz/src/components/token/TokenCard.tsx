import Link from 'next/link';
import type { TokenSummary } from '@/types/token';
import { chainLabel } from '@/lib/chains';
import { cn, formatAge, formatPct, formatPrice, formatUsd } from '@/lib/utils';
import { ActivityBadge } from './RiskBadge';

export function TokenAvatar({ src, symbol, size = 36 }: { src: string | null; symbol: string; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} loading="lazy" className="rounded-full bg-panel2 object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="grid place-items-center rounded-full bg-panel2 text-xs font-semibold text-muted" style={{ width: size, height: size }} aria-hidden>
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function TokenCard({ t }: { t: TokenSummary }) {
  const up = t.change24h >= 0;
  return (
    <Link
      href={`/token/${t.address}?chain=${t.chain}`}
      className="block rounded-xl border border-line bg-panel p-3 transition-colors hover:border-brand/60"
    >
      <div className="flex items-center gap-3">
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{t.symbol} <span className="text-sm font-normal text-muted">{t.name}</span></p>
          <p className="text-xs text-muted">{chainLabel(t.chain)} · {formatAge(t.pairCreatedAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">{formatPrice(t.priceUsd)}</p>
          <p className={cn('text-xs font-medium', up ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(t.change24h)}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted">MC</dt><dd>{formatUsd(t.marketCap)}</dd></div>
        <div><dt className="text-muted">Liquidez</dt><dd>{formatUsd(t.liquidityUsd)}</dd></div>
        <div><dt className="text-muted">Vol 24h</dt><dd>{formatUsd(t.volume24h)}</dd></div>
      </dl>
      <div className="mt-3"><ActivityBadge status={t.activity} /></div>
    </Link>
  );
}
