'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Flame, Languages, TrendingUp } from 'lucide-react';
import { chainLabel } from '@/lib/chains';
import { cn, formatNumber, formatPct, formatPrice, formatUsd } from '@/lib/utils';
import type { TrendItem, TrendWindow, TrendsResponse } from '@/types/social';

const WINDOWS: TrendWindow[] = ['1h', '6h', '24h'];

type Filters = { solana: boolean; base: boolean; liquidity: boolean; rising: boolean };

/** Ejemplo para ver cómo queda mientras no haya token de X. */
const DEMO: TrendItem[] = [
  { key: 'd1', symbol: 'PEPITO', name: 'Pepito Coin', chain: 'solana', address: 'DemoSoLAddr1111111111111111111111111111111', mentions: 184, recentMentions: 131, momentum: 2.5, engagement: 5230, indexed: true, liquidityUsd: 210_000, priceUsd: 0.0042, change24h: 38.2, projectX: 'https://x.com/pepito', voices: [{ username: 'cripto_ana', name: 'Ana', followers: 52_000, url: '#' }],
    topTweet: { id: '1', author: null, lang: 'en', text: 'Everyone is sleeping on $PEPITO. Dev burned LP, 3k holders already, CT is just starting to notice.', likes: 812, reposts: 140, replies: 66, url: '#' } },
  { key: 'd2', symbol: 'CHINGON', name: 'Chingón', chain: 'base', address: '0xDemo000000000000000000000000000000000001', mentions: 97, recentMentions: 40, momentum: 0.7, engagement: 1890, indexed: true, liquidityUsd: 64_000, priceUsd: 0.00091, change24h: -6.4, projectX: null, voices: [],
    topTweet: { id: '2', author: null, lang: 'es', text: 'Qué bueno ver $CHINGON en tendencia, la comunidad latina está empujando fuerte esta semana.', likes: 301, reposts: 52, replies: 29, url: '#' } },
  { key: 'd3', symbol: 'ZHU', name: null, chain: null, address: '0xDemo000000000000000000000000000000000002', mentions: 41, recentMentions: 33, momentum: 4.1, engagement: 960, indexed: false, liquidityUsd: 0, priceUsd: null, change24h: null, projectX: null, voices: [],
    topTweet: { id: '3', author: null, lang: 'zh', text: '新币 $ZHU 刚上线，合约地址在下面，早期玩家都在关注。', likes: 120, reposts: 31, replies: 12, url: '#' } },
];

function translateUrl(text: string) {
  return `https://translate.google.com/?sl=auto&tl=es&op=translate&text=${encodeURIComponent(text)}`;
}

function ageLabel(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}

export function TrendsBoard() {
  const [win, setWin] = useState<TrendWindow>('6h');
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [err, setErr] = useState(false);
  const [f, setF] = useState<Filters>({ solana: false, base: false, liquidity: false, rising: false });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/tendencias?window=${win}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as TrendsResponse;
        if (alive) { setData(json); setErr(false); }
      } catch { if (alive) setErr(true); }
    };
    setData(null);
    void load();
    const every = { '1h': 60_000, '6h': 120_000, '24h': 300_000 }[win];
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, every);
    return () => { alive = false; clearInterval(id); };
  }, [win]);

  const demo = data !== null && !data.configured;
  const source = demo ? DEMO : data?.items ?? [];

  const items = useMemo(() => {
    return source.filter((i) => {
      // Solana y Base se combinan con "o": si marcas las dos, salen las de cualquiera.
      if ((f.solana || f.base) && !((f.solana && i.chain === 'solana') || (f.base && i.chain === 'base'))) return false;
      if (f.liquidity && !i.indexed) return false;
      if (f.rising && !(i.momentum >= 1.5 && i.recentMentions >= 3)) return false;
      return true;
    });
  }, [source, f]);

  const toggle = (k: keyof Filters) => setF((p) => ({ ...p, [k]: !p[k] }));
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-xs', on ? 'border-brand/60 bg-brand/15 text-brand' : 'border-line text-muted hover:text-ink');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Ventana de tiempo">
          {WINDOWS.map((w) => (
            <button key={w} role="tab" aria-selected={win === w} onClick={() => setWin(w)} className={cn('rounded-lg px-3 py-1.5 text-sm', win === w ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}>Últimas {w}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={chip(f.solana)} aria-pressed={f.solana} onClick={() => toggle('solana')}>Solana</button>
          <button className={chip(f.base)} aria-pressed={f.base} onClick={() => toggle('base')}>Base</button>
          <button className={chip(f.liquidity)} aria-pressed={f.liquidity} onClick={() => toggle('liquidity')}>Con liquidez</button>
          <button className={chip(f.rising)} aria-pressed={f.rising} onClick={() => toggle('rising')}>Subiendo en menciones</button>
        </div>
      </div>

      {data && data.configured && (
        <p className="text-xs text-muted">Datos calculados {ageLabel(data.updatedAt)} · se renuevan cada {data.refreshSeconds >= 60 ? `${Math.round(data.refreshSeconds / 60)} min` : `${data.refreshSeconds} s`}.</p>
      )}

      {demo && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Estos son datos de <b>ejemplo</b>. Para ver las menciones reales hay que conectar la API de X (variable <code>X_BEARER_TOKEN</code>, plan de pago de X con búsqueda). Mira el README.
        </p>
      )}
      {err && !data && <p className="text-sm text-rose-400">No pudimos cargar las tendencias. Intenta de nuevo en un momento.</p>}
      {!data && !err && <div className="h-40 animate-pulse rounded-xl bg-panel/60" aria-busy="true" />}
      {data && items.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Ninguna moneda cumple esos filtros ahora mismo. Quita alguno.</p>}

      <ol className="space-y-3">
        {items.map((i, idx) => {
          const t = i.topTweet;
          const href = i.address ? `/token/${i.address}${i.chain ? `?chain=${i.chain}` : ''}` : null;
          return (
            <li key={i.key} className="rounded-xl border border-line bg-panel/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 text-center text-lg font-semibold text-muted">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">
                    ${i.symbol} {i.name && <span className="text-sm font-normal text-muted">{i.name}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {i.chain && <span className="rounded-full border border-line px-2 py-0.5 text-muted">{chainLabel(i.chain)}</span>}
                    {i.momentum >= 1.5 && i.recentMentions >= 3 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"><TrendingUp className="h-3 w-3" aria-hidden /> Subiendo ×{i.momentum.toFixed(1)}</span>
                    )}
                    {i.indexed ? <span className="text-muted">Liquidez {formatUsd(i.liquidityUsd)}</span> : <span className="text-muted">Sin liquidez / no indexada</span>}
                    {i.priceUsd !== null && <span className="text-muted">{formatPrice(i.priceUsd)}</span>}
                    {i.change24h !== null && <span className={i.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPct(i.change24h)} 24h</span>}
                  </div>
                </div>
                <div className="flex gap-5 text-right">
                  <div><p className="flex items-center justify-end gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-brand" aria-hidden />{formatNumber(i.mentions)}</p><p className="text-xs text-muted">menciones</p></div>
                  <div><p className="text-xl font-semibold">{formatNumber(i.engagement)}</p><p className="text-xs text-muted">interacciones</p></div>
                </div>
                {i.projectX && (
                  <a href={i.projectX} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/60">X del proyecto <ExternalLink className="h-3 w-3" aria-hidden /></a>
                )}
                {demo ? (
                  <span className="rounded-lg border border-line px-3 py-2 text-sm text-muted">Ejemplo</span>
                ) : href ? (
                  <Link href={href} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-bg hover:bg-brand-dim">{i.indexed ? 'Ver análisis y holders' : 'Analizar contract'}</Link>
                ) : (
                  <span className="rounded-lg border border-line px-3 py-2 text-xs text-muted">Sin contrato todavía</span>
                )}
              </div>

              {t && (
                <blockquote className="mt-3 rounded-lg border-l-2 border-brand/50 bg-panel2/40 p-3 text-sm">
                  {t.author && (
                    <p className="mb-1 text-xs">
                      <a href={t.author.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-brand">@{t.author.username}</a>
                      <span className="text-muted"> · {formatNumber(t.author.followers)} seguidores</span>
                    </p>
                  )}
                  <p className="line-clamp-4 whitespace-pre-line">{t.text}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>♥ {formatNumber(t.likes)} · ⟲ {formatNumber(t.reposts)} · 💬 {formatNumber(t.replies)}</span>
                    <span className="uppercase">{t.lang}</span>
                    {t.lang !== 'es' && (
                      <a href={translateUrl(t.text)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Languages className="h-3 w-3" aria-hidden /> Traducir al español</a>
                    )}
                    {!demo && <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand">Ver en X <ExternalLink className="h-3 w-3" aria-hidden /></a>}
                  </p>
                </blockquote>
              )}
              {i.voices.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  Quién habla:
                  {i.voices.map((v) => (
                    <a key={v.username} href={v.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">@{v.username} <span className="opacity-70">({formatNumber(v.followers)})</span></a>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">Las menciones se cuentan en tweets recientes con $TICKER o contract address, en cualquier idioma. “Subiendo” compara la segunda mitad de la ventana con la primera. No es asesoría financiera.</p>
    </div>
  );
}
