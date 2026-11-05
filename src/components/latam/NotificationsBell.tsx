'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useUser } from '@/components/auth/UserProvider';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { cn, formatAge } from '@/lib/utils';
import type { AppNotification } from '@/types/community';

const STANCE = { alcista: 'alcista', bajista: 'bajista', cuidado: 'de precaución' } as const;

function describe(n: AppNotification): { text: string; href: string } {
  const u = n.payload.username ?? 'alguien';
  const profile = `/perfil/${u}`;
  if (n.type === 'follow') return { text: `@${u} empezó a seguirte`, href: profile };
  if (n.type === 'reaction') return { text: `@${u} reaccionó ${n.payload.emoji ?? ''} a tu mensaje`, href: profile };
  const { symbol, chain, address, stance } = n.payload;
  return {
    text: `@${u} publicó una tesis ${stance ? STANCE[stance] : ''} sobre $${symbol ?? 'un token'}`,
    href: address ? `/token/${address}?chain=${chain ?? ''}` : profile,
  };
}

/** Campana: lista tus últimas 20 notificaciones y se actualiza en vivo (Realtime, filtrado por tu user_id). */
export function NotificationsBell() {
  const { user } = useUser();
  const uid = user?.id;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || !uid) return;
    let alive = true;
    sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (alive && data) setItems(data as AppNotification[]); });
    const channel = sb
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload: { new?: unknown }) => {
        setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => { alive = false; void sb.removeChannel(channel); };
  }, [uid]);

  const unread = items.filter((n) => !n.read_at).length;

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    const sb = getBrowserSupabase();
    if (next && unread > 0 && sb && uid) {
      const now = new Date().toISOString();
      const { error } = await sb.from('notifications').update({ read_at: now }).eq('user_id', uid).is('read_at', null);
      // Se dejan "sin leer" visualmente mientras el panel está abierto; al cerrarlo ya cuentan como leídas.
      if (!error) setTimeout(() => setItems((p) => p.map((n) => (n.read_at ? n : { ...n, read_at: now }))), 4000);
    }
  }, [open, unread, uid]);

  if (!uid) return null;
  return (
    <div className="relative">
      <button onClick={toggle} aria-label={unread ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'} aria-expanded={open} className="relative rounded-lg p-2 text-muted hover:text-ink">
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-xl border border-line bg-panel shadow-xl">
            <p className="border-b border-line px-3 py-2 text-sm font-medium">Notificaciones</p>
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted">Todavía no tienes notificaciones. Cuando alguien te siga o reaccione a tus mensajes, te avisamos aquí.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((n) => {
                  const d = describe(n);
                  return (
                    <li key={n.id}>
                      <Link href={d.href} onClick={() => setOpen(false)} className={cn('block border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-panel2', !n.read_at && 'bg-brand/5')}>
                        <p>{d.text}</p>
                        <p suppressHydrationWarning className="text-xs text-muted">{formatAge(new Date(n.created_at).getTime())}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
