import Link from 'next/link';
import { Rocket, Users } from 'lucide-react';
import type { ColumnId, TokenSummary } from '@/types/token';
import { badgeFor, PREFERRED_TOP10 } from '@/lib/filters';
import { chainLabel } from '@/lib/chains';
import { cn, formatAge } from '@/lib/utils';
import { LiveValue } from '@/components/live/LiveValue';
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

interface CardProps {
  t: TokenSummary;
  members?: number;
  /** Columna donde se muestra: decide el badge (Fantasma / Poca actividad / Con vida). */
  column?: ColumnId;
  /** Apareció en el último refresco automático. */
  fresh?: boolean;
  /** $LATAM en boosts vigentes (0/undefined = sin boost). */
  boost?: number;
}

export function TokenCard({ t, members, column, fresh, boost }: CardProps) {
  const pref = column ? PREFERRED_TOP10[column] : undefined;
  const topOk = t.top10Pct !== null && pref !== undefined ? t.top10Pct <= pref : null;
  return (
    <Link
      href={`/token/${t.address}?chain=${t.chain}`}
      className={cn(
        'block rounded-xl border bg-panel p-3 transition-colors hover:border-brand/60',
        fresh || boost ? 'border-brand/70 shadow-[0_0_0_1px_rgba(255,176,46,0.35)]' : 'border-line',
      )}
    >
      <div className="flex items-center gap-3">
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {t.symbol} <span className="text-sm font-normal text-muted">{t.name}</span>
            {boost ? <span title={`${boost} $LATAM en boost`} className="ml-2 inline-flex items-center gap-1 rounded bg-brand/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-brand"><Rocket className="h-3 w-3" aria-hidden />Boost</span> : null}
            {fresh && <span className="ml-2 rounded bg-brand px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-bg">Nuevo</span>}
          </p>
          <p suppressHydrationWarning className="text-xs text-muted">{chainLabel(t.chain)} · {formatAge(t.pairCreatedAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm"><LiveValue value={t.priceUsd} kind="price" /></p>
          <p className="text-xs font-medium"><LiveValue value={t.change24h} kind="pct" signed /></p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted">MC</dt><dd><LiveValue value={t.marketCap} kind="usd" /></dd></div>
        <div><dt className="text-muted">Liquidez</dt><dd><LiveValue value={t.liquidityUsd} kind="usd" /></dd></div>
        <div><dt className="text-muted">Vol 24h</dt><dd><LiveValue value={t.volume24h} kind="usd" /></dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ActivityBadge status={column ? badgeFor(column, t) : t.activity} />
          {t.top10Pct !== null && (
            <span
              title="% del supply en los 10 mayores holders (sin contar pools)"
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs',
                topOk === null ? 'border-line text-muted' : topOk ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300',
              )}
            >
              Top10 {t.top10Pct.toFixed(0)}%
            </span>
          )}
        </div>
        {members !== undefined && (
          <span className="flex items-center gap-1 text-xs text-muted" title="Miembros de su comunidad">
            <Users className="h-3.5 w-3.5" aria-hidden />{members} {members === 1 ? 'miembro' : 'miembros'}
          </span>
        )}
      </div>
    </Link>
  );
}
