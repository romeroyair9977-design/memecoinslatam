'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** Botón de sesión del header. Escucha cambios de auth para actualizarse sin recargar. */
export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) { setReady(true); return; }
    let alive = true;
    const load = async (uid: string | undefined) => {
      if (!uid) { if (alive) { setUsername(null); setReady(true); } return; }
      const { data } = await sb.from('profiles').select('username').eq('id', uid).maybeSingle();
      if (alive) { setUsername(data?.username ?? null); setReady(true); }
    };
    sb.auth.getUser().then(({ data }) => load(data.user?.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { void load(session?.user.id); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (!ready) return <div className="h-8 w-16" aria-hidden />;
  if (!username) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-bg hover:bg-brand-dim">
        Entrar
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href={`/perfil/${username}`} className="max-w-[9rem] truncate rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand/60">@{username}</Link>
      <button
        onClick={async () => { await getBrowserSupabase()?.auth.signOut(); router.refresh(); }}
        aria-label="Cerrar sesión"
        className="rounded-lg p-2 text-muted hover:text-ink"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
