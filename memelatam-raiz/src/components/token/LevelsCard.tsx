'use client';

import { useEffect, useMemo, useState } from 'react';
import { LiveValue } from '@/components/live/LiveValue';
import { LEVELS, levelMessage, levelStats, parseUsd, type LevelData } from '@/lib/levels';
import { MOMENTUM_LABEL, computeMomentum, type MomentumState } from '@/lib/momentum';
import { useNow } from '@/lib/hooks/live';
import { sellImpact } from '@/lib/whales';
import { cn, formatNumber, formatPct, formatUsd } from '@/lib/utils';
import { useLiveMarket } from './LiveTokenProvider';

interface Props {
  chain: string;
  address: string;
  pairAddress: string;
  symbol: string;
  /** Motivo de riesgo grave (mint/freeze activos, top 10 muy concentrado) o null */
  riskReason: string | null;
}

const STATE_CLS: Record<MomentumState, string> = {
  acelerando: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  sostenido: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  enfriandose: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  colapsando: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};
const TONE_CLS = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  bad: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
} as const;

const fmtX = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'short' });

/** Niveles de 10 en 10, impulso (FOMO) en vivo y calculadora "Mi entrada". Sin cuenta: todo corre en tu navegador. */
export function LevelsCard({ chain, address, pairAddress, symbol, riskReason }: Props) {
  const { market } = useLiveMarket();
  const now = useNow(5_000);
  const [data, setData] = useState<LevelData | null | undefined>(undefined);
  const [mode, setMode] = useState<'mc' | 'price'>('mc');
  const [entry, setEntry] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/token/${encodeURIComponent(address)}/levels?chain=${encodeURIComponent(chain)}&pair=${encodeURIComponent(pairAddress)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
      .then((d: { data: LevelData | null }) => { if (!cancelled) setData(d.data); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [chain, address, pairAddress]);

  const mc = market.marketCap || market.fdv;
  const mom = computeMomentum({
    flow: market.flow,
    ageMs: now && market.pairCreatedAt ? now - market.pairCreatedAt : null,
    liquidityUsd: market.liquidityUsd,
    priceChangeM5: market.change.m5,
  });
  const stats = useMemo(() => (data ? levelStats(data, market.priceUsd, mc) : null), [data, market.priceUsd, mc]);
  const msg = levelMessage({ state: mom.state, currentX: stats?.currentX ?? 0, peakX: stats?.peakX ?? 0, nextLevel: stats?.nextLevel ?? null, riskReason });

  // ── Mi entrada ──
  const entryN = parseUsd(entry);
  const amountN = parseUsd(amount);
  const mult = entryN ? (mode === 'mc' ? mc : market.priceUsd) / entryN : null;
  const valueNow = mult !== null && amountN ? amountN * mult : null;
  const proceeds = valueNow ? sellImpact(valueNow, market.liquidityUsd).proceedsUsd : null;
  const nextEntryLevels = mult !== null ? LEVELS.filter((l) => l > mult).slice(0, 2) : [];

  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel/50 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Niveles e impulso de {symbol}</h2>
        <p className="text-sm text-muted">Cuánto ha subido desde su primer dato, en niveles de 10 en 10, y si el FOMO sigue entrando o se está apagando.</p>
      </div>

      {/* Niveles */}
      {data === undefined && <div className="h-16 animate-pulse rounded-lg border border-line bg-panel" aria-hidden />}
      {data === null && <p className="text-sm text-muted">Todavía no hay velas suficientes para calcular sus niveles (token muy nuevo o pool no indexado).</p>}
      {data && stats && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-panel p-3"><dt className="text-xs text-muted">Salió en (aprox.)</dt><dd className="text-lg font-semibold">{formatUsd(stats.launchMc)}</dd></div>
            <div className="rounded-lg border border-line bg-panel p-3"><dt className="text-xs text-muted">Hoy</dt><dd className="text-lg font-semibold">x{fmtX(stats.currentX)}</dd></div>
            <div className="rounded-lg border border-line bg-panel p-3"><dt className="text-xs text-muted">Pico</dt><dd className="text-lg font-semibold">x{fmtX(stats.peakX)}</dd><p className="text-xs text-muted">{formatUsd(stats.peakMc)}</p></div>
            <div className="rounded-lg border border-line bg-panel p-3"><dt className="text-xs text-muted">Caída desde el pico</dt><dd className={cn('text-lg font-semibold', stats.drawdownPct >= 50 ? 'text-rose-300' : stats.drawdownPct >= 20 ? 'text-amber-300' : 'text-emerald-300')}>-{stats.drawdownPct.toFixed(0)}%</dd></div>
          </dl>
          <ul className="flex flex-wrap gap-2" aria-label="Niveles alcanzados">
            {LEVELS.map((l) => {
              const r = data.reached.find((x) => x.level === l);
              return (
                <li key={l} className={cn('rounded-full border px-3 py-1 text-sm', r ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-line text-muted')}>
                  x{formatNumber(l)} {r ? `· ${fmtDate(r.at)}` : stats.nextLevel === l ? `· meta ${formatUsd(stats.launchMc * l)}` : ''}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">Desde {fmtDate(data.firstAt)} (primera vela disponible). La fecha de cada nivel tiene precisión de un día y «salió en» es una estimación.</p>
        </div>
      )}

      {/* Impulso */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full border px-3 py-1 text-sm font-medium', STATE_CLS[mom.state])}>{MOMENTUM_LABEL[mom.state]}</span>
          <span className="text-sm text-muted">FOMO <strong className="text-ink">{mom.fomo}/100</strong></span>
          <span className="text-sm text-muted">{mom.buysPerMin.toFixed(1)} compras/min</span>
          <span className="text-sm text-muted">{Math.round(mom.buyShare5 * 100)}% compras (5 min)</span>
          <span className="text-sm text-muted">5 min <LiveValue value={market.change.m5} kind="pct" signed /></span>
        </div>
        <div className={cn('rounded-lg border p-3 text-sm', TONE_CLS[msg.tone])}>{msg.text}</div>
        {mom.reasons.length > 0 && (
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {mom.reasons.map((r) => <li key={r.text} className={r.good ? 'text-emerald-300' : 'text-rose-300'}>{r.good ? '+ ' : '- '}{r.text}</li>)}
          </ul>
        )}
      </div>

      {/* Mi entrada */}
      <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
        <h3 className="text-sm font-medium">Mi entrada</h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg bg-bg p-1" role="tablist" aria-label="Tipo de entrada">
            {([['mc', 'Market cap'], ['price', 'Precio']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn('rounded-md px-3 py-1 text-xs font-medium', mode === id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}>{label}</button>
            ))}
          </div>
          <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder={mode === 'mc' ? 'MC de entrada (ej. 85k)' : 'Precio de entrada (ej. 0.0000123)'} aria-label="Entrada" className="h-9 min-w-48 flex-1 rounded-md border border-line bg-bg px-2 text-sm placeholder:text-muted" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Invertido en USD (opcional)" aria-label="Monto invertido" className="h-9 min-w-40 flex-1 rounded-md border border-line bg-bg px-2 text-sm placeholder:text-muted" />
        </div>
        {entry !== '' && entryN === null && <p className="text-xs text-amber-300">No entendí ese número. Usa formatos como 85000, 85k o 1.5m.</p>}
        {mult !== null && (
          <ul className="space-y-1 text-sm">
            <li>Vas en <strong className={mult >= 1 ? 'text-emerald-300' : 'text-rose-300'}>x{fmtX(mult)}</strong> ({formatPct((mult - 1) * 100, 0)}).</li>
            {valueNow !== null && proceeds !== null && (
              <li>Tu posición valdría <strong>{formatUsd(valueNow)}</strong>; si la vendes ahora, el pool te pagaría ≈ <strong>{formatUsd(proceeds)}</strong> por el deslizamiento (modelo).</li>
            )}
            {nextEntryLevels.map((l) => (
              <li key={l} className="text-muted">
                Para x{formatNumber(l)} desde tu entrada: {mode === 'mc' ? `market cap de ${formatUsd((entryN as number) * l)}` : `precio de ${(entryN as number) * l}`}.
              </li>
            ))}
            {mult >= 10 && !riskReason && <li className="text-emerald-300">Ya pasaste x10 desde tu entrada: asegurar una parte de la ganancia reduce el riesgo.</li>}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted">
        Son señales con su explicación, no órdenes ni promesas: nadie puede saber si una memecoin seguirá subiendo. Una señal de salida llega cuando el precio ya empezó a bajar. Mide compras (no personas distintas) en ventanas de 5 minutos. No es asesoría financiera.
      </p>
    </section>
  );
}
