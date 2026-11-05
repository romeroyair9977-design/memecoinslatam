'use client';

import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { createPrediction } from '@/app/actions/predictions';
import { detectAddressKind } from '@/lib/addresses';
import { CATEGORIES, HORIZONS, rewardFor, type Side } from '@/lib/predictions';
import { cn } from '@/lib/utils';

interface Props {
  loggedIn: boolean;
  enabled: boolean;
  /** Si se llega desde la página de un token, ya viene precargado */
  initialAddress?: string;
  initialChain?: string;
}

export function PredictionForm({ loggedIn, enabled, initialAddress = '', initialChain = '' }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [side, setSide] = useState<Side>('vive');
  const [days, setDays] = useState<number>(30);
  const [category, setCategory] = useState<string>('general');
  const [msg, setMsg] = useState<{ ok: boolean; text: string; login?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const a = address.trim();
    const kind = detectAddressKind(a);
    if (!kind) return setMsg({ ok: false, text: 'Pega un contract address válido.' });
    const chain = initialChain || (kind === 'solana' ? 'solana' : '');
    start(async () => {
      // EVM sin red indicada: la chain se resuelve en el servidor probando la de mayor liquidez (Base por defecto).
      const res = await createPrediction(chain || 'base', a, side, days, category);
      setMsg(res.ok
        ? { ok: true, text: `Listo: ${res.symbol} ${side === 'vive' ? 'seguirá viva' : 'estará muerta'} en ${HORIZONS.find((h) => h.days === days)?.label}. Se resuelve sola el ${new Date(res.dueAt).toLocaleDateString('es')}.` }
        : { ok: false, text: res.error, login: res.needsLogin });
      if (res.ok) setAddress('');
    });
  }

  const chip = (active: boolean) => cn('rounded-lg border px-3 py-2 text-sm', active ? 'border-brand/70 bg-brand/10 text-ink' : 'border-line text-muted hover:text-ink');

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-panel/50 p-4">
      <div>
        <label htmlFor="pred-addr" className="mb-1 block text-sm text-muted">Contract address del token</label>
        <input id="pred-addr" value={address} onChange={(e) => setAddress(e.target.value)} spellCheck={false} placeholder="Pega aquí el contract address" className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm placeholder:text-muted" />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm text-muted">Tu apuesta</legend>
        <div className="flex gap-2">
          <button type="button" aria-pressed={side === 'vive'} onClick={() => setSide('vive')} className={chip(side === 'vive')}>🚀 Seguirá viva</button>
          <button type="button" aria-pressed={side === 'muere'} onClick={() => setSide('muere')} className={chip(side === 'muere')}>💀 Morirá</button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm text-muted">¿Cuánto va a perdurar?</legend>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((h) => (
            <button key={h.days} type="button" aria-pressed={days === h.days} onClick={() => setDays(h.days)} className={chip(days === h.days)}>
              {h.label} <span className="text-xs text-brand">+{rewardFor(h.days, side)} $LATAM</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm text-muted">Tipo de memecoin</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} className={chip(category === c.id)}>{c.label}</button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !enabled} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-bg hover:bg-brand-dim disabled:opacity-60">
          {pending ? 'Guardando…' : 'Hacer mi predicción'}
        </button>
        {!loggedIn && enabled && <Link href="/login?next=/predicciones" className="text-sm text-brand hover:underline">Inicia sesión para predecir</Link>}
        {!enabled && <span className="text-sm text-muted">Disponible cuando se conecte Supabase.</span>}
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={cn('text-sm', msg.ok ? 'text-emerald-300' : 'text-rose-400')}>
          {msg.text} {msg.login && <Link href="/login?next=/predicciones" className="underline">Entrar</Link>}
        </p>
      )}
    </form>
  );
}
