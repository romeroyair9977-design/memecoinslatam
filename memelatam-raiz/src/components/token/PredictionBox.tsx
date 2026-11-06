'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Hourglass } from 'lucide-react';
import { placePrediction } from '@/app/actions/predictions';
import { useUser } from '@/components/auth/UserProvider';
import { ALIVE_RULE, HORIZONS, PREDICTION_COST, PREDICTION_PAYOUT, type Horizon, type Side } from '@/lib/predictions';
import { formatLatam } from '@/lib/latam';
import { cn } from '@/lib/utils';
import type { MyPrediction, PredictionStats } from '@/lib/services/predictions';

interface Props {
  chain: string;
  address: string;
  symbol: string;
  loggedIn: boolean;
  demo: boolean;
  stats: PredictionStats;
  mine: MyPrediction[];
}

const STATUS: Record<MyPrediction['status'], string> = { open: 'abierta', won: 'acertada', lost: 'fallada' };

/** Predicción de permanencia: ¿seguirá viva esta memecoin en 7, 30 o 90 días? */
export function PredictionBox({ chain, address, symbol, loggedIn, demo, stats, mine }: Props) {
  const router = useRouter();
  const { user, refresh } = useUser();
  const [days, setDays] = useState<Horizon>(7);
  const [side, setSide] = useState<Side>('vive');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const total = stats.vive + stats.muere;
  const vivePct = total > 0 ? Math.round((stats.vive / total) * 100) : 50;
  const balance = user?.points_balance ?? 0;

  function go() {
    setMsg(null);
    start(async () => {
      const res = await placePrediction(chain, address, days, side);
      if (!res.ok) {
        if (res.needsLogin) return router.push(`/login?next=${encodeURIComponent(`/token/${address}?chain=${chain}`)}`);
        return setMsg({ ok: false, text: res.error });
      }
      setMsg({ ok: true, text: `Predicción guardada: ${symbol} ${side === 'vive' ? 'seguirá viva' : 'morirá'} en ${days} días. Lo sabremos el día del plazo.` });
      void refresh();
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-panel/50 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <Hourglass className="h-5 w-5 text-brand" aria-hidden /> ¿Cuánto va a durar {symbol}?
      </h2>
      <p className="mb-3 text-sm text-muted">
        Apuesta {formatLatam(PREDICTION_COST)} a que sigue viva (o muerta) cuando pase el plazo. Si aciertas recibes {formatLatam(PREDICTION_PAYOUT)} y subes en el <a href="/ranking" className="text-brand hover:underline">ranking</a>.
      </p>

      {total > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Vivirá {vivePct}% ({stats.vive})</span><span>Morirá {100 - vivePct}% ({stats.muere})</span></div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-rose-400/60" role="img" aria-label={`${vivePct} por ciento cree que seguirá viva`}>
            <div className="bg-emerald-400" style={{ width: `${vivePct}%` }} />
          </div>
        </div>
      )}

      {demo ? (
        <p className="text-sm text-muted">Las predicciones se activan al conectar Supabase.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Plazo">
            {HORIZONS.map((h) => (
              <button key={h} role="radio" aria-checked={days === h} onClick={() => setDays(h)} className={cn('rounded-full border px-3 py-1 text-sm', days === h ? 'border-brand/60 bg-panel2' : 'border-line text-muted hover:text-ink')}>
                {h} días
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Postura">
            {([['vive', 'Seguirá viva'], ['muere', 'Morirá']] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={side === id} onClick={() => setSide(id)} className={cn('rounded-full border px-3 py-1 text-sm', side === id ? (id === 'vive' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/50 bg-rose-500/10 text-rose-300') : 'border-line text-muted hover:text-ink')}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => (loggedIn ? go() : router.push(`/login?next=${encodeURIComponent(`/token/${address}?chain=${chain}`)}`))}
            disabled={pending || (loggedIn && balance < PREDICTION_COST)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60"
          >
            {pending ? 'Guardando…' : loggedIn ? `Predecir (cuesta ${formatLatam(PREDICTION_COST)})` : 'Entrar para predecir'}
          </button>
          {loggedIn && balance < PREDICTION_COST && <p className="text-xs text-muted">Te faltan $LATAM. Gánalos publicando tesis o creando comunidades.</p>}
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('mt-2 text-sm', msg.ok ? 'text-emerald-300' : 'text-rose-400')}>{msg.text}</p>}

      {mine.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {mine.map((m, i) => (
            <li key={`${m.horizon_days}-${m.resolves_at}-${i}`}>
              Tu predicción: {m.side === 'vive' ? 'vivirá' : 'morirá'} a {m.horizon_days} días · {STATUS[m.status]}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">{ALIVE_RULE} Los $LATAM son puntos de la plataforma, no dinero ni criptomoneda.</p>
    </section>
  );
}
