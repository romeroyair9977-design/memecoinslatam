'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { featureThesis, postThesis } from '@/app/actions/community';
import { useUser } from '@/components/auth/UserProvider';
import { LATAM } from '@/lib/latam';
import { cn, formatAge } from '@/lib/utils';
import type { Stance, Thesis } from '@/types/community';

const STANCES: { id: Stance; label: string; cls: string }[] = [
  { id: 'alcista', label: 'Alcista', cls: 'border-emerald-500/40 text-emerald-300' },
  { id: 'bajista', label: 'Bajista', cls: 'border-rose-500/40 text-rose-300' },
  { id: 'cuidado', label: 'Ojo, posible scam', cls: 'border-amber-500/40 text-amber-300' },
];

interface Props {
  chain: string;
  address: string;
  initial: Thesis[];
  loggedIn: boolean;
  /** Sin Supabase: se muestran tesis de ejemplo y el formulario queda deshabilitado. */
  demo?: boolean;
}

/** Tesis de la comunidad: se guardan en Supabase (tabla `theses`) y alimentan el feed de actividad. */
export function ThesisSection({ chain, address, initial, loggedIn, demo }: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [stance, setStance] = useState<Stance>('alcista');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { user, refresh } = useUser();
  const next = `/token/${address}?chain=${chain}`;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) return setError('Cuéntanos un poco más (mínimo 5 caracteres).');
    setError(null); setNotice(null);
    start(async () => {
      const res = await postThesis(chain, address, stance, text);
      if (!res.ok) {
        if (res.needsLogin) return router.push(`/login?next=${encodeURIComponent(next)}`);
        return setError(res.error);
      }
      setText('');
      setNotice(res.earned ? `Tesis publicada. Ganaste +${res.earned} ${LATAM.symbol}.` : 'Tesis publicada. (Ya alcanzaste el tope diario de $LATAM por tesis.)');
      void refresh();
      router.refresh();
    });
  }

  function feature(id: string) {
    setError(null); setNotice(null);
    start(async () => {
      const res = await featureThesis(id, address);
      if (!res.ok) return setError(res.error);
      setNotice('Tesis destacada por 24 h.');
      void refresh();
      router.refresh();
    });
  }

  const canPost = loggedIn && !demo;

  return (
    <div className="space-y-4">
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
          disabled={demo}
          placeholder="¿Por qué sí o por qué no? Cuenta tu tesis en pocas líneas."
          className="w-full rounded-lg border border-line bg-panel p-3 text-sm placeholder:text-muted disabled:opacity-60"
          aria-label="Tu tesis"
        />
        <div className="flex items-center gap-3">
          {canPost || !demo ? (
            <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">
              {pending ? 'Publicando…' : loggedIn ? 'Publicar tesis' : 'Entrar para publicar'}
            </button>
          ) : null}
          {demo && <p className="text-xs text-muted">Modo demo: conecta Supabase para publicar.</p>}
          {!loggedIn && !demo && <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-brand hover:underline">Iniciar sesión</Link>}
        </div>
        {loggedIn && !demo && <p className="text-xs text-muted">Publicar una tesis te da +{LATAM.thesis} {LATAM.symbol}.</p>}
        {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      </form>

      {initial.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Aún no hay tesis sobre este token. Sé la primera persona en publicar la tuya.</p>
      ) : (
        <ul className="space-y-2">
          {initial.map((t) => {
            const s = STANCES.find((x) => x.id === t.stance);
            const featured = !!t.featured_until && new Date(t.featured_until).getTime() > Date.now();
            return (
              <li key={t.id} className={cn('rounded-lg border bg-panel p-3 text-sm', featured ? 'border-brand/50' : 'border-line')}>
                <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {featured && <span className="inline-flex items-center gap-1 rounded bg-brand/15 px-1.5 py-0.5 font-semibold text-brand"><Sparkles className="h-3 w-3" aria-hidden />Destacada</span>}
                  <span className={cn('font-medium', s?.cls.split(' ')[1])}>{s?.label}</span>
                  {t.author && <Link href={`/perfil/${t.author.username}`} className="hover:text-ink hover:underline">@{t.author.username}</Link>}
                  <time dateTime={t.created_at}>· {formatAge(new Date(t.created_at).getTime())}</time>
                </p>
                <p className="whitespace-pre-wrap break-words">{t.body}</p>
                {user && user.id === t.user_id && (
                  <button onClick={() => feature(t.id)} disabled={pending || user.points_balance < LATAM.featureThesisCost} className="mt-2 text-xs text-brand hover:underline disabled:opacity-50 disabled:no-underline">
                    Destacar 24 h · {LATAM.featureThesisCost} {LATAM.symbol}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
