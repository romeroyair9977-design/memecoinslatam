'use client';

import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';

type Stance = 'alcista' | 'bajista' | 'cuidado';
interface Thesis { id: number; stance: Stance; text: string; at: number }

const STANCES: { id: Stance; label: string; cls: string }[] = [
  { id: 'alcista', label: 'Alcista', cls: 'border-emerald-500/40 text-emerald-300' },
  { id: 'bajista', label: 'Bajista', cls: 'border-rose-500/40 text-rose-300' },
  { id: 'cuidado', label: 'Ojo, posible scam', cls: 'border-amber-500/40 text-amber-300' },
];

/**
 * DEMO: las tesis viven en estado local y se pierden al recargar.
 * TODO (iteración Supabase): tabla `theses(token_key, user_id, stance, body, created_at)` + realtime + auth.
 */
export function ThesisSection({ tokenKey }: { tokenKey: string }) {
  const [items, setItems] = useState<Thesis[]>([]);
  const [text, setText] = useState('');
  const [stance, setStance] = useState<Stance>('alcista');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) return;
    setItems((prev) => [{ id: Date.now(), stance, text: text.trim(), at: Date.now() }, ...prev]);
    setText('');
  }

  return (
    <div data-token={tokenKey} className="space-y-4">
      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Postura">
          {STANCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={stance === s.id}
              onClick={() => setStance(s.id)}
              className={cn('rounded-full border px-3 py-1 text-sm', stance === s.id ? `${s.cls} bg-panel2` : 'border-line text-muted')}
            >
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="¿Por qué sí o por qué no? Cuenta tu tesis en pocas líneas."
          className="w-full rounded-lg border border-line bg-panel p-3 text-sm placeholder:text-muted"
          aria-label="Tu tesis"
        />
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:bg-brand-dim">Publicar tesis</button>
      </form>
      <p className="text-xs text-muted">Demo local: aún no se guarda. Pronto con cuenta y wallet.</p>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className="rounded-lg border border-line bg-panel p-3 text-sm">
            <span className={cn('mr-2 text-xs font-medium', STANCES.find((s) => s.id === t.stance)?.cls.split(' ')[1])}>
              {STANCES.find((s) => s.id === t.stance)?.label}
            </span>
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
