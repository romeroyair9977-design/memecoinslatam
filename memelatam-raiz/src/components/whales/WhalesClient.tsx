'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Age } from '@/components/live/Age';
import { TokenAvatar } from '@/components/token/TokenCard';
import { usePolling } from '@/lib/hooks/live';
import { WHALE_RISK_LABEL, type WhaleRisk } from '@/lib/whales';
import { cn, formatUsd } from '@/lib/utils';
import type { WhaleBoard, WhaleToken } from '@/types/market';
import { WhaleImpact } from './WhaleImpact';

const RISK_CLS: Record<WhaleRisk, string> = {
  critico: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  alto: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  medio: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  bajo: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

function WhaleCard({ t }: { t: WhaleToken }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={40} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-medium">{t.symbol} <span className="text-sm font-normal text-muted">{t.name}</span></p>
          <p className="text-xs text-muted">MC {formatUsd(t.marketCap)} · Liq. {formatUsd(t.liquidityUsd)} · <Age ts={t.pairCreatedAt} /></p>
        </div>
        <dl className="grid grid-cols-3 gap-x-5 text-center text-xs">
          <div><dt className="text-muted">5 ballenas</dt><dd className="text-base font-semibold">{formatUsd(t.whaleUsd)}</dd></div>
          <div><dt className="text-muted">Ballena #1</dt><dd className="text-base font-semibold">{t.top1Pct.toFixed(1)}%</dd></div>
          <div><dt className="text-muted">Top 3</dt><dd className="text-base font-semibold">{t.top3Pct.toFixed(1)}%</dd></div>
        </dl>
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', RISK_CLS[t.risk])}>{WHALE_RISK_LABEL[t.risk]}</span>
        <div className="flex gap-2">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60">
            {open ? 'Ocultar escenarios' : 'Si venden…'}
          </button>
          <Link href={`/token/${t.address}?chain=${t.chain}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">Analizar</Link>
        </div>
      </div>
      {open && <div className="mt-3 border-t border-line pt-3"><WhaleImpact chain={t.chain} whales={t.whales} scenarios={t.scenarios} /></div>}
    </li>
  );
}

function Section({ title, hint, items }: { title: string; hint: string; items: WhaleToken[] }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {items.length === 0
        ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Ninguna por ahora.</p>
        : <ul className="space-y-2">{items.map((t) => <WhaleCard key={t.address} t={t} />)}</ul>}
    </section>
  );
}

export function WhalesClient() {
  const [board, setBoard] = useState<WhaleBoard | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ballenas', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setBoard((await res.json()) as WhaleBoard);
      setStatus('ok');
    } catch {
      setStatus((s) => (s === 'ok' ? s : 'error'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  usePolling(load, 60_000);

  if (status === 'loading') return <ul className="space-y-2" aria-hidden>{[0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl border border-line bg-panel" />)}</ul>;
  if (status === 'error' || !board) return <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No pudimos cargar las ballenas ahora. Se reintenta solo cada minuto.</p>;

  const established = board.items.filter((t) => t.established);
  const fresh = board.items.filter((t) => !t.established);
  return (
    <div className="space-y-8">
      {board.pending > 0 && (
        <p role="status" className="text-xs text-muted">Analizamos {board.scanned} tokens. Faltan {board.pending} por revisar: se completan en las próximas actualizaciones.</p>
      )}
      <Section title="Ballenas ahora: tokens ya establecidos" hint="Más de 7 días de vida. Quién tiene la mayor parte del supply y cuánto caería el precio si vende." items={established} />
      <Section title="Ballenas en lanzamientos recientes" hint="Menos de 7 días. Aquí las ballenas suelen ser insiders o snipers: si venden, el precio se rompe." items={fresh} />
    </div>
  );
}
