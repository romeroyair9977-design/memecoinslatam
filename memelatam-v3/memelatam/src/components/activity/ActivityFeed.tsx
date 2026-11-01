'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageSquarePlus, Users } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { cn, formatAge } from '@/lib/utils';
import type { ActivityEvent } from '@/types/community';

const STANCE_TXT = { alcista: 'alcista', bajista: 'bajista', cuidado: 'de precaución' } as const;
const STANCE_CLS = { alcista: 'text-emerald-300', bajista: 'text-rose-300', cuidado: 'text-amber-300' } as const;

function Event({ ev }: { ev: ActivityEvent }) {
  const p = ev.payload;
  const who = p.username ? <Link href={`/perfil/${p.username}`} className="font-medium hover:underline">@{p.username}</Link> : <span>Alguien</span>;
  const tok = p.symbol && p.chain && p.address
    ? <Link href={`/token/${p.address}?chain=${p.chain}`} className="font-medium text-brand hover:underline">${p.symbol}</Link>
    : <span>un token</span>;

  if (ev.type === 'thesis') {
    return <>{who} abrió una tesis <span className={p.stance ? STANCE_CLS[p.stance] : ''}>{p.stance ? STANCE_TXT[p.stance] : ''}</span> en {tok}</>;
  }
  if (ev.type === 'community_created') {
    return <>{who} creó la comunidad de {p.chain && p.address ? <Link href={`/comunidad/${p.chain}/${p.address}`} className="font-medium text-brand hover:underline">${p.symbol}</Link> : tok}</>;
  }
  return <>{who} se unió a la comunidad de {tok}</>;
}

interface Props {
  initial: ActivityEvent[];
  compact?: boolean;
  demo?: boolean;
  /** Si viene, solo se muestran eventos de estos actores (filtro "Siguiendo"), también en tiempo real. */
  onlyActors?: string[] | null;
}

export function ActivityFeed({ initial, compact, demo, onlyActors }: Props) {
  const [events, setEvents] = useState(initial);

  useEffect(() => { setEvents(initial); }, [initial]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || demo) return;
    const ch = sb
      .channel(`activity:${onlyActors ? 'following' : 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, (p) => {
        const ev = p.new as ActivityEvent;
        if (onlyActors && (!ev.actor_id || !onlyActors.includes(ev.actor_id))) return;
        setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev].slice(0, 50)));
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [demo, onlyActors]);

  if (!events.length) {
    return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Todavía no hay actividad. Publica una tesis o crea una comunidad para abrir el feed.</p>;
  }
  return (
    <ul className={cn('space-y-2', !compact && 'space-y-3')}>
      {events.map((ev) => (
        <li key={ev.id} className={cn('flex items-start gap-3 text-sm', !compact && 'rounded-xl border border-line bg-panel p-3')}>
          <span className="mt-0.5 text-muted" aria-hidden>{ev.type === 'thesis' ? <MessageSquarePlus className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span>
          <span className="min-w-0 flex-1"><Event ev={ev} /></span>
          <time dateTime={ev.created_at} className="shrink-0 text-xs text-muted">{formatAge(new Date(ev.created_at).getTime())}</time>
        </li>
      ))}
    </ul>
  );
}
