'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

export interface SessionUser { id: string; username: string; points_balance: number }
interface Ctx { user: SessionUser | null; ready: boolean; refresh: () => Promise<void> }

const UserCtx = createContext<Ctx>({ user: null, ready: false, refresh: async () => {} });

/** Usuario logueado + balance de $LATAM. El balance se actualiza solo (Realtime sobre `profiles`). */
export const useUser = () => useContext(UserCtx);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (uid?: string) => {
    const sb = getBrowserSupabase();
    if (!sb || !uid) { setUser(null); setReady(true); return; }
    const { data } = await sb.from('profiles').select('id, username, points_balance').eq('id', uid).maybeSingle();
    setUser((data as SessionUser | null) ?? null);
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    await load(data.user?.id);
  }, [load]);

  // Sesión: carga inicial + cambios de auth (login/logout en otra pestaña incluidos).
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) { setReady(true); return; }
    void refresh();
    // setTimeout(0): no se debe llamar a supabase dentro del callback de onAuthStateChange (puede bloquearse).
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => { void load(session?.user.id); }, 0); });
    return () => sub.subscription.unsubscribe();
  }, [load, refresh]);

  // Balance en vivo: cada vez que Postgres actualiza tu fila de `profiles` (ganaste o gastaste $LATAM).
  const uid = user?.id;
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || !uid) return;
    const channel = sb
      .channel(`profile:${uid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, (payload: { new?: unknown }) => {
        const row = payload.new as Partial<SessionUser> | undefined;
        if (row && typeof row.points_balance === 'number') setUser((u) => (u ? { ...u, points_balance: row.points_balance as number, username: row.username ?? u.username } : u));
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [uid]);

  const value = useMemo(() => ({ user, ready, refresh }), [user, ready, refresh]);
  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}
