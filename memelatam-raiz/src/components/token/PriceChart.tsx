'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { explorerUrl } from '@/lib/chains';
import { cn, formatNumber, formatPrice, formatUsd, shortAddress } from '@/lib/utils';
import type { Candle, ChartTrade } from '@/lib/services/chart';

type TF = '5m' | '15m' | '1h' | '4h' | '1d';
const TFS: TF[] = ['5m', '15m', '1h', '4h', '1d'];
const TF_SECONDS: Record<TF, number> = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

interface Payload { candles: Candle[]; trades: ChartTrade[] }

interface Props {
  chain: string;
  pool: string;
  token: string;
  symbol: string;
  /** Wallets del top de holders (si la fuente las da) para resaltarlas en el gráfico. */
  holderAddresses: string[];
  totalHolders: number | null;
  /** Gráfico avanzado de respaldo (embed) por si los datos propios no están disponibles. */
  advancedSrc: string;
}

const W = 900;
const H = 420;
const M = { l: 8, r: 70, t: 12, b: 24 };
const PLOT_W = W - M.l - M.r;
const PLOT_H = H - M.t - M.b;
const VOL_H = PLOT_H * 0.16;
const PRICE_H = PLOT_H - VOL_H - 8;

function ago(t: number) {
  const m = Math.max(0, Math.floor((Date.now() / 1000 - t) / 60));
  if (m < 1) return 'hace segundos';
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h`;
}

function fmtTime(t: number, tf: TF) {
  const d = new Date(t * 1000);
  return tf === '1d' || tf === '4h'
    ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function PriceChart({ chain, pool, token, symbol, holderAddresses, totalHolders, advancedSrc }: Props) {
  const [tf, setTf] = useState<TF>('15m');
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [mode, setMode] = useState<'veltrix' | 'avanzado'>('veltrix');
  const [showWallets, setShowWallets] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'veltrix') return;
    let alive = true;
    const load = async (first: boolean) => {
      if (first) setStatus('loading');
      try {
        const qs = new URLSearchParams({ chain, pool, token, tf });
        const res = await fetch(`/api/chart?${qs.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Payload;
        if (alive) { setData(json); setStatus('ok'); setTip(null); }
      } catch {
        if (alive && first) setStatus('error');
      }
    };
    void load(true);
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(false); }, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [chain, pool, token, tf, mode]);

  const holderSet = useMemo(() => new Set(holderAddresses.map((a) => a.toLowerCase())), [holderAddresses]);

  const geo = useMemo(() => {
    const candles = data?.candles ?? [];
    if (!candles.length) return null;
    let lo = Infinity;
    let hi = -Infinity;
    let maxV = 0;
    for (const c of candles) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); maxV = Math.max(maxV, c.v); }
    const pad = (hi - lo || hi * 0.02) * 0.06;
    lo = Math.max(0, lo - pad);
    hi += pad;
    const step = PLOT_W / candles.length;
    const x = (i: number) => M.l + step * (i + 0.5);
    const y = (p: number) => M.t + ((hi - Math.min(Math.max(p, lo), hi)) / (hi - lo)) * PRICE_H;
    const yVol = (v: number) => M.t + PLOT_H - (maxV ? (v / maxV) * VOL_H : 0);
    return { candles, lo, hi, step, x, y, yVol };
  }, [data]);

  /** Compras/ventas ubicadas dentro del rango de velas visible. */
  const bubbles = useMemo(() => {
    if (!geo || !data) return [];
    const { candles, x, step } = geo;
    const sec = TF_SECONDS[tf];
    const first = candles[0].t;
    return data.trades
      .filter((t) => t.t >= first)
      .map((t) => {
        let a = 0;
        let b = candles.length - 1;
        while (a < b) { const mid = (a + b + 1) >> 1; if (candles[mid].t <= t.t) a = mid; else b = mid - 1; }
        const frac = Math.min(1, Math.max(0, (t.t - candles[a].t) / sec));
        return { trade: t, cx: x(a) + (frac - 0.5) * step, isHolder: holderSet.has(t.wallet.toLowerCase()) };
      });
  }, [geo, data, tf, holderSet]);

  const wallets = useMemo(() => {
    const m = new Map<string, { wallet: string; buyUsd: number; sellUsd: number; buys: number; sells: number; firstBuy: number; priceSum: number }>();
    for (const t of data?.trades ?? []) {
      const w = m.get(t.wallet) ?? { wallet: t.wallet, buyUsd: 0, sellUsd: 0, buys: 0, sells: 0, firstBuy: Infinity, priceSum: 0 };
      if (t.side === 'buy') { w.buyUsd += t.usd; w.buys += 1; w.firstBuy = Math.min(w.firstBuy, t.t); w.priceSum += t.price * t.usd; }
      else { w.sellUsd += t.usd; w.sells += 1; }
      m.set(t.wallet, w);
    }
    return [...m.values()];
  }, [data]);

  const buyers = wallets.filter((w) => w.buys > 0);
  const topEntries = [...buyers].sort((a, b) => b.buyUsd - a.buyUsd).slice(0, 8);
  const holdersTrading = wallets.filter((w) => holderSet.has(w.wallet.toLowerCase())).length;
  const last = geo ? geo.candles[geo.candles.length - 1] : null;
  const shown = geo && hover !== null ? geo.candles[hover] : last;
  const activeTip = tip !== null ? bubbles[tip]?.trade : null;

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * PLOT_W;
    setHover(Math.min(geo.candles.length - 1, Math.max(0, Math.floor(px / geo.step))));
  }

  const ticksY = geo ? Array.from({ length: 5 }, (_, i) => geo.lo + ((geo.hi - geo.lo) * i) / 4) : [];
  const ticksX = geo ? [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.min(geo.candles.length - 1, Math.floor(geo.candles.length * f))) : [];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel/50">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2 text-xs">
        <div className="flex gap-1" role="tablist" aria-label="Tipo de gráfico">
          {([['veltrix', 'Gráfico'], ['avanzado', 'Avanzado']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className={cn('rounded-md px-2.5 py-1', mode === id ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}>{label}</button>
          ))}
        </div>
        {mode === 'veltrix' && (
          <>
            <div className="flex gap-1" role="group" aria-label="Intervalo">
              {TFS.map((t) => (
                <button key={t} onClick={() => setTf(t)} aria-pressed={tf === t}
                  className={cn('rounded-md px-2 py-1', tf === t ? 'bg-brand/20 text-brand' : 'text-muted hover:text-ink')}>{t}</button>
              ))}
            </div>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-muted">
              <input type="checkbox" checked={showWallets} onChange={(e) => setShowWallets(e.target.checked)} className="accent-amber-400" />
              Mostrar wallets
            </label>
          </>
        )}
      </div>

      {mode === 'avanzado' && (
        <iframe title={`Gráfico avanzado de ${symbol}`} src={advancedSrc} className="h-[420px] w-full bg-panel" loading="lazy" />
      )}

      {mode === 'veltrix' && status === 'error' && !data && (
        <div className="space-y-3 p-6 text-center text-sm text-muted">
          <p>No pudimos cargar el gráfico de {symbol} (el pool puede ser muy nuevo o la fuente está ocupada).</p>
          <button onClick={() => setMode('avanzado')} className="rounded-lg border border-line px-3 py-1.5 text-ink hover:border-brand/60">Probar el gráfico avanzado</button>
        </div>
      )}

      {mode === 'veltrix' && status === 'loading' && !data && <div className="h-[420px] animate-pulse bg-panel/60" aria-busy="true" />}

      {mode === 'veltrix' && geo && shown && (
        <div>
          {/* Leyenda OHLC */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-2 text-xs text-muted">
            <span className="font-medium text-ink">{symbol}/USD · {tf}</span>
            <span>A <b className="text-ink">{formatPrice(shown.o)}</b></span>
            <span>Máx <b className="text-ink">{formatPrice(shown.h)}</b></span>
            <span>Mín <b className="text-ink">{formatPrice(shown.l)}</b></span>
            <span>C <b className={shown.c >= shown.o ? 'text-emerald-400' : 'text-rose-400'}>{formatPrice(shown.c)}</b></span>
            <span>Vol <b className="text-ink">{formatUsd(shown.v)}</b></span>
            {totalHolders !== null && (
              <span className="ml-auto rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-brand">{formatNumber(totalHolders)} holders</span>
            )}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" role="img" aria-label={`Gráfico de velas de ${symbol} con las compras y ventas recientes`}>
            {ticksY.map((p, i) => (
              <g key={i}>
                <line x1={M.l} x2={W - M.r} y1={geo.y(p)} y2={geo.y(p)} stroke="#2a3459" strokeOpacity={0.5} strokeDasharray="3 4" />
                <text x={W - M.r + 6} y={geo.y(p) + 4} fontSize={11} fill="#8c97b8">{formatPrice(p)}</text>
              </g>
            ))}
            {ticksX.map((i) => (
              <text key={i} x={geo.x(i)} y={H - 6} fontSize={11} fill="#8c97b8" textAnchor="middle">{fmtTime(geo.candles[i].t, tf)}</text>
            ))}

            {geo.candles.map((c, i) => {
              const up = c.c >= c.o;
              const col = up ? '#34d399' : '#fb7185';
              const top = geo.y(Math.max(c.o, c.c));
              const bodyH = Math.max(1, Math.abs(geo.y(c.o) - geo.y(c.c)));
              const bw = Math.max(1, geo.step * 0.7);
              return (
                <g key={c.t}>
                  <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.y(c.h)} y2={geo.y(c.l)} stroke={col} strokeWidth={1} />
                  <rect x={geo.x(i) - bw / 2} y={top} width={bw} height={bodyH} fill={col} />
                  <rect x={geo.x(i) - bw / 2} y={geo.yVol(c.v)} width={bw} height={M.t + PLOT_H - geo.yVol(c.v)} fill={col} opacity={0.25} />
                </g>
              );
            })}

            {/* Precio actual */}
            {last && (
              <g>
                <line x1={M.l} x2={W - M.r} y1={geo.y(last.c)} y2={geo.y(last.c)} stroke="#ffb02e" strokeOpacity={0.6} strokeDasharray="2 3" />
                <rect x={W - M.r + 2} y={geo.y(last.c) - 9} width={M.r - 4} height={18} rx={3} fill="#ffb02e" />
                <text x={W - M.r + 6} y={geo.y(last.c) + 4} fontSize={11} fontWeight={600} fill="#0d1221">{formatPrice(last.c)}</text>
              </g>
            )}

            {hover !== null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={M.t} y2={M.t + PLOT_H} stroke="#8c97b8" strokeOpacity={0.5} />}
            <rect x={M.l} y={M.t} width={PLOT_W} height={PLOT_H} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={() => setTip(null)} />

            {/* Wallets: verde = compra, rojo = venta, tamaño = monto, aro dorado = wallet del top de holders */}
            {showWallets && bubbles.map((b, i) => {
              const r = Math.min(12, 3 + Math.sqrt(Math.max(0, b.trade.usd)) / 5);
              const col = b.trade.side === 'buy' ? '#34d399' : '#fb7185';
              return (
                <circle key={`${b.trade.tx}-${i}`} cx={b.cx} cy={geo.y(b.trade.price)} r={b.isHolder ? r + 1.5 : r}
                  fill={col} fillOpacity={0.45} stroke={b.isHolder ? '#ffb02e' : col} strokeWidth={b.isHolder ? 2.5 : 1}
                  className="cursor-pointer" onMouseEnter={() => setTip(i)} onClick={(e) => { e.stopPropagation(); setTip(i); }} />
              );
            })}
          </svg>

          {/* Detalle de la burbuja elegida */}
          <div className="min-h-[2.25rem] border-t border-line px-3 py-2 text-xs text-muted">
            {activeTip ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className={activeTip.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>{activeTip.side === 'buy' ? 'Compra' : 'Venta'} {formatUsd(activeTip.usd)}</b>
                <span>a {formatPrice(activeTip.price)}</span>
                <span>{ago(activeTip.t)}</span>
                {(() => {
                  const u = explorerUrl(chain, activeTip.wallet);
                  const label = shortAddress(activeTip.wallet, 5);
                  return u ? <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-brand">{label}<ExternalLink className="h-3 w-3" aria-hidden /></a> : <span className="text-ink">{label}</span>;
                })()}
                {holderSet.has(activeTip.wallet.toLowerCase()) && <span className="rounded bg-brand/15 px-1.5 py-0.5 text-brand">top holder</span>}
              </span>
            ) : showWallets ? (
              bubbles.length
                ? 'Toca una burbuja para ver la wallet. Verde = compra, roja = venta, más grande = más dinero.'
                : 'Sin operaciones recientes para dibujar en este rango.'
            ) : 'Wallets ocultas.'}
          </div>

          {/* Entradas por wallet */}
          {topEntries.length > 0 && (
            <div className="border-t border-line p-3">
              <p className="mb-2 text-xs text-muted">
                <b className="text-ink">{formatNumber(buyers.length)}</b> wallets compraron en las últimas operaciones del pool
                {holderAddresses.length > 0 && <> · <b className="text-ink">{holdersTrading}</b> del top de holders operaron</>}.
                Entradas más grandes:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted">
                    <tr><th className="py-1 pr-2 font-medium">Wallet</th><th className="px-2 font-medium">Compró</th><th className="px-2 font-medium">Entrada prom.</th><th className="px-2 font-medium">Primera compra</th><th className="pl-2 text-right font-medium">Vendió</th></tr>
                  </thead>
                  <tbody>
                    {topEntries.map((w) => {
                      const u = explorerUrl(chain, w.wallet);
                      return (
                        <tr key={w.wallet} className="border-t border-line">
                          <td className="py-1.5 pr-2">
                            {u ? <a href={u} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{shortAddress(w.wallet, 5)}</a> : shortAddress(w.wallet, 5)}
                            {holderSet.has(w.wallet.toLowerCase()) && <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-brand">top holder</span>}
                          </td>
                          <td className="px-2 text-emerald-400">{formatUsd(w.buyUsd)}</td>
                          <td className="px-2">{formatPrice(w.priceSum / w.buyUsd)}</td>
                          <td className="px-2 text-muted">{ago(w.firstBuy)}</td>
                          <td className="pl-2 text-right text-rose-400">{w.sellUsd > 0 ? formatUsd(w.sellUsd) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">Solo vemos las últimas operaciones del pool (hasta 300 de las últimas 24 h). Quien compró antes no aparece aquí.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
