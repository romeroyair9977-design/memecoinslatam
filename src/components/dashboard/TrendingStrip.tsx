import Link from 'next/link';
import type { TokenSummary } from '@/types/token';
import { TokenAvatar } from '@/components/token/TokenCard';
import { cn, formatPct } from '@/lib/utils';

function Chip({ t, dup }: { t: TokenSummary; dup?: boolean }) {
  return (
    <Link
      href={`/token/${t.address}?chain=${t.chain}`}
      tabIndex={dup ? -1 : undefined}
      className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-sm hover:border-brand/60"
    >
      <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={24} />
      <span className="font-medium">{t.symbol}</span>
      <span className={cn('text-xs', t.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(t.change24h, 0)}</span>
    </Link>
  );
}

/** Ticker superior: tokens en tendencia en movimiento continuo (se duplica la lista para el bucle sin saltos). */
export function TrendingStrip({ tokens }: { tokens: TokenSummary[] }) {
  if (!tokens.length) return null;
  return (
    <div className="ml-marquee -mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0" aria-label="Tokens en tendencia">
      <ul className="ml-marquee-track gap-2">
        {[...tokens, ...tokens].map((t, i) => (
          <li key={`${t.chain}:${t.address}:${i}`} className="mr-2" aria-hidden={i >= tokens.length || undefined}>
            <Chip t={t} dup={i >= tokens.length} />
          </li>
        ))}
      </ul>
    </div>
  );
}
