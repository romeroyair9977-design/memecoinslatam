'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Heart, MessageCircle, Minus, Repeat2, TrendingDown, TrendingUp } from 'lucide-react';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { cn, formatAge, formatNumber, formatPrice, formatPct, formatUsd } from '@/lib/utils';
import type { XTrendItem, XTweet } from '@/types/xtrends';

/** Momentum: cuánto más rápido se menciona en el último 25 % de la ventana que antes. */
export function momentumInfo(m: number, mentions: number): { label: string; cls: string; Icon: typeof Minus } {
  if (mentions >= 5 && m >= 3) return { label: 'Explotando', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300', Icon: TrendingUp };
  if (mentions >= 5 && m >= 1.5) return { label: 'Subiendo', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', Icon: TrendingUp };
  if (m < 0.7) return { label: 'Enfriándose', cls: 'border-slate-500/40 bg-slate-500/10 text-slate-300', Icon: TrendingDown };
  return { label: 'Estable', cls: 'border-line text-muted', Icon: Minus };
}

const googleTranslate = (text: string) => `https://translate.google.com/?sl=auto&tl=es&text=${encodeURIComponent(text)}&op=translate`;

function Tweets({ term, hours }: { term: string; hours: number }) {
  const [tweets, setTweets] = useState<XTweet[] | null>(null);
  const [error, setError] = useState(false);

  // Se cargan solo al abrir la fila (pedirlos todos de golpe sería lento y caro).
  useEffect(() => {
    let cancelled = false;
    setTweets(null);
    setError(false);
    fetch(`/api/x-trends/tweets?term=${encodeURIComponent(term)}&hours=${hours}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
      .then((d: { tweets: XTweet[] }) => { if (!cancelled) setTweets(d.tweets); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [term, hours]);

  if (tweets === null && !error) return <p role="status" className="text-sm text-muted">Cargando tweets…</p>;
  if (error) return <p className="text-sm text-muted">No pudimos cargar los tweets ahora. Intenta de nuevo en un momento.</p>;
  if (!tweets || tweets.length === 0) return <p className="text-sm text-muted">No hay tweets guardados para este token en esta ventana.</p>;

  return (
    <ul className="space-y-2">
      {tweets.map((t) => {
        const shown = t.textEs ?? t.text;
        return (
          <li key={t.id} className="rounded-lg border border-line bg-bg p-3 text-sm">
            <p className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="font-medium text-ink">@{t.author || 'anónimo'}</span>
              <span suppressHydrationWarning>{formatAge(Date.parse(t.at))}</span>
              {t.lang && t.lang !== 'es' && <span className="rounded border border-line px-1">{t.lang}</span>}
              {t.textEs && <span className="rounded border border-brand/40 px-1 text-brand">traducido</span>}
            </p>
            <p className="whitespace-pre-line break-words">{shown}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden /> {formatNumber(t.likes)}</span>
              <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" aria-hidden /> {formatNumber(t.retweets)}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> {formatNumber(t.replies)}</span>
              {t.lang && t.lang !== 'es' && !t.textEs && (
                <a href={googleTranslate(t.text)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Traducir al español</a>
              )}
              {t.url && (
                <a href={t.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto flex items-center gap-1 hover:text-ink">
                  Ver en X <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function XTrendRow({ item, rank, hours }: { item: XTrendItem; rank: number; hours: number }) {
  const [open, setOpen] = useState(false);
  const t = item.token;
  const mo = momentumInfo(item.momentum, item.mentions);
  const MoIcon = mo.Icon;

  return (
    <li className="rounded-xl border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="w-6 text-center text-sm text-muted">{rank}</span>
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={40} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-medium">{t.symbol} <span className="text-sm font-normal text-muted">{t.name}</span></p>
          <p className="text-xs text-muted">
            {chainLabel(t.chain)} · {formatPrice(t.priceUsd)} <span className={t.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPct(t.change24h)}</span>
          </p>
          {item.ambiguous && (
            <p className="mt-0.5 text-xs text-amber-300">Hay varios tokens con el símbolo {item.term}. Verifica el contract antes de comprar.</p>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-x-5 text-center text-xs">
          <div><dt className="text-muted">Menciones</dt><dd className="text-base font-semibold">{formatNumber(item.mentions)}</dd></div>
          <div><dt className="text-muted">Autores</dt><dd className="text-base font-semibold">{formatNumber(item.authors)}</dd></div>
          <div><dt className="text-muted">Engagement</dt><dd className="text-base font-semibold">{formatNumber(item.engagement)}</dd></div>
        </dl>

        <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium', mo.cls)}>
            <MoIcon className="h-3.5 w-3.5" aria-hidden /> {mo.label} · x{item.momentum.toFixed(1)}
          </span>
          <span className="text-muted">Liq. {formatUsd(t.liquidityUsd)} · MC {formatUsd(t.marketCap)}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60">
            {open ? 'Ocultar tweets' : 'Ver tweets'}
          </button>
          <Link href={`/token/${t.address}?chain=${t.chain}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">
            Analizar
          </Link>
        </div>
      </div>
      {open && <div className="mt-3 border-t border-line pt-3"><Tweets term={item.term} hours={hours} /></div>}
    </li>
  );
}
