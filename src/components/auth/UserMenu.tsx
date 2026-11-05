'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Zap } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { LATAM } from '@/lib/latam';
import { NotificationsBell } from '@/components/latam/NotificationsBell';
import { useUser } from './UserProvider';

/** Sesión del header: balance de $LATAM, notificaciones, perfil y salir. */
export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, refresh } = useUser();

  if (!ready) return <div className="h-8 w-16" aria-hidden />;
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">
        Entrar
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href={`/perfil/${user.username}`}
        title="Tu balance de $LATAM"
        className="flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand/20"
      >
        <Zap className="h-3.5 w-3.5" aria-hidden />
        <span aria-label={`${user.points_balance} ${LATAM.symbol}`}>{user.points_balance.toLocaleString('es')}</span>
        <span className="hidden text-xs font-normal sm:inline">{LATAM.symbol}</span>
      </Link>
      <NotificationsBell />
      <Link href={`/perfil/${user.username}`} className="hidden max-w-[9rem] truncate rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60 sm:block">@{user.username}</Link>
      <button
        onClick={async () => { await getBrowserSupabase()?.auth.signOut(); await refresh(); router.refresh(); }}
        aria-label="Cerrar sesión"
        className="rounded-lg p-2 text-muted hover:text-ink"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
