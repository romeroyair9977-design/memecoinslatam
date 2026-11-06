'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Rocket } from 'lucide-react';
import { boostToken } from '@/app/actions/community';
import { useUser } from '@/components/auth/UserProvider';
import { BOOST_OPTIONS, boostHours, formatLatam } from '@/lib/latam';
import { cn } from '@/lib/utils';

interface Props {
  chain: string;
  address: string;
  symbol: string;
  /** $LATAM en boosts vigentes de este token (0 = sin boost). */
  activeTotal: number;
  loggedIn: boolean;
}

/** Gasta $LATAM para subir el token en el dashboard. El cobro y la validación del balance ocurren en Postgres. */
export function BoostButton({ chain, address, symbol, activeTotal, loggedIn }: Props) {
  const router = useRouter();
  const { user, refresh } = useUser();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const balance = user?.points_balance ?? 0;

  function go(amount: number) {
    setMsg(null);
    start(async () => {
      const res = await boostToken(chain, address, amount);
      if (!res.ok) {
        if (res.needsLogin) return router.push(`/login?next=${encodeURIComponent(`/token/${address}?chain=${chain}`)}`);
        return setMsg({ ok: false, text: res.error });
      }
      setMsg({ ok: true, text: `¡Listo! ${symbol} sube en el dashboard durante ${boostHours(amount)} h.` });
      void refresh();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => (loggedIn ? setOpen((o) => !o) : router.push(`/login?next=${encodeURIComponent(`/token/${address}?chain=${chain}`)}`))}
        className={cn('inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium', activeTotal > 0 ? 'border-brand/60 bg-brand/10 text-brand' : 'border-line hover:border-brand/60')}
        aria-expanded={open}
      >
        <Rocket className="h-4 w-4" aria-hidden />
        {activeTotal > 0 ? `Con boost · ${formatLatam(activeTotal)}` : 'Dar boost con $LATAM'}
      </button>

      {open && (
        <div className="rounded-xl border border-line bg-panel p-3 text-sm">
          <p className="mb-2 text-muted">
            El boost sube a {symbol} en el dashboard y lo marca como destacado. 10 $LATAM = 1 hora. Tu balance: <strong className="text-ink">{formatLatam(balance)}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            {BOOST_OPTIONS.map((a) => (
              <button key={a} disabled={pending || balance < a} onClick={() => go(a)} className="rounded-lg border border-line px-3 py-1.5 hover:border-brand/60 disabled:opacity-50">
                {a} $LATAM <span className="text-xs text-muted">· {boostHours(a)} h</span>
              </button>
            ))}
          </div>
          {balance < BOOST_OPTIONS[0] && <p className="mt-2 text-xs text-muted">Te faltan $LATAM. Gánalos publicando tesis (+2), creando comunidades (+10), recibiendo reacciones (+1) o acertando predicciones.</p>}
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('text-sm', msg.ok ? 'text-emerald-300' : 'text-rose-400')}>{msg.text}</p>}
    </div>
  );
}
