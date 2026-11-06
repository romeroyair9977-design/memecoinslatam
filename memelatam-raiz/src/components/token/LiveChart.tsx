'use client';

import { useEffect, useRef, useState } from 'react';
import { ColorType, CrosshairMode, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { usePolling } from '@/lib/hooks/live';
import { cn } from '@/lib/utils';
import type { Candle } from '@/types/token';
import { useLiveMarket } from './LiveTokenProvider';

const TFS = [
  { id: '1m', sec: 60 },
  { id: '5m', sec: 300 },
  { id: '15m', sec: 900 },
  { id: '1h', sec: 3600 },
  { id: '4h', sec: 14400 },
  { id: '1d', sec: 86400 },
] as const;
type Tf = (typeof TFS)[number]['id'];

interface Props {
  chain: string;
  pairAddress: string;
  tokenAddress: string;
  /** Si no se pueden cargar las velas, el panel cae al gráfico embebido de DexScreener. */
  onFail: () => void;
}

const toBar = (c: Candle) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });

/**
 * Gráfico de velas propio (TradingView Lightweight Charts):
 *  - historial desde GeckoTerminal,
 *  - la última vela se actualiza cada 6 s con datos del pool,
 *  - y entre una consulta y otra se mueve con el precio en vivo del token.
 */
export default function LiveChart({ chain, pairAddress, tokenAddress, onFail }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastRef = useRef<Candle | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const [tf, setTf] = useState<Tf>('1m');
  const [ready, setReady] = useState(false);
  const { market } = useLiveMarket();
  const tfSec = TFS.find((t) => t.id === tf)?.sec ?? 60;

  const query = (limit: number) =>
    `chain=${encodeURIComponent(chain)}&pair=${encodeURIComponent(pairAddress)}&token=${encodeURIComponent(tokenAddress)}&tf=${tf}&limit=${limit}`;

  // 1) Crear el gráfico una sola vez.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8c97b8' },
      grid: { vertLines: { color: '#1b2442' }, horzLines: { color: '#1b2442' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a3459' },
      timeScale: { borderColor: '#2a3459', timeVisible: true, secondsVisible: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#34d399',
      downColor: '#fb7185',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 2) Cargar el historial al abrir y cada vez que cambia el intervalo.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const res = await fetch(`/api/chart?${query(300)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('chart');
        const { candles } = (await res.json()) as { candles: Candle[] };
        const series = seriesRef.current;
        if (cancelled || !series) return;
        if (candles.length === 0) throw new Error('empty');
        const ref = candles[candles.length - 1].close;
        // Memecoins con precios como 0.00000123 necesitan más decimales en el eje.
        const precision = ref >= 1 ? 2 : ref > 0 ? Math.min(12, Math.ceil(-Math.log10(ref)) + 4) : 8;
        series.applyOptions({ priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) } });
        series.setData(candles.map(toBar));
        lastRef.current = candles[candles.length - 1];
        chartRef.current?.timeScale().fitContent();
        setReady(true);
      } catch {
        if (!cancelled) failRef.current();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf, chain, pairAddress, tokenAddress]);

  // 3) Refrescar las últimas velas cada 6 s.
  usePolling(async () => {
    const series = seriesRef.current;
    if (!series) return;
    const res = await fetch(`/api/chart?${query(3)}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { candles } = (await res.json()) as { candles: Candle[] };
    for (const c of candles) {
      if (lastRef.current && c.time < lastRef.current.time) continue;
      series.update(toBar(c));
      lastRef.current = c;
    }
  }, 6000, ready);

  // 4) Entre consultas, la vela actual se mueve con el precio en vivo.
  useEffect(() => {
    const series = seriesRef.current;
    const last = lastRef.current;
    const p = market.priceUsd;
    if (!ready || !series || !last || !(p > 0)) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = nowSec - (nowSec % tfSec);
    const next: Candle =
      bucket > last.time
        ? { time: bucket, open: last.close, high: Math.max(last.close, p), low: Math.min(last.close, p), close: p, volume: 0 }
        : { ...last, close: p, high: Math.max(last.high, p), low: Math.min(last.low, p) };
    lastRef.current = next;
    series.update(toBar(next));
  }, [market.priceUsd, ready, tfSec]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div role="tablist" aria-label="Intervalo de las velas" className="flex gap-1">
          {TFS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tf === t.id}
              onClick={() => setTf(t.id)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', tf === t.id ? 'bg-brand text-bg' : 'text-muted hover:text-ink')}
            >
              {t.id}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden /> Velas en vivo
        </span>
      </div>
      <div ref={boxRef} className="h-[380px] w-full" />
      {!ready && <p role="status" className="px-3 pb-3 text-xs text-muted">Cargando velas…</p>}
    </div>
  );
}
