import type { Metadata } from 'next';
import Link from 'next/link';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { DemoBanner } from '@/components/community/parts';
import { getMe } from '@/lib/auth';
import { MOCK_ACTIVITY } from '@/lib/mock';
import { getActivity, getFollowingIds } from '@/lib/services/community';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Actividad', description: 'Tesis nuevas, comunidades creadas y movimiento de la comunidad latina de memecoins.' };
export const dynamic = 'force-dynamic';

export default async function ActivityPage({ searchParams }: { searchParams: { filtro?: string } }) {
  const demo = !isSupabaseConfigured;
  const me = await getMe();
  const following = searchParams.filtro === 'siguiendo' && me;
  const ids = following ? await getFollowingIds(me.id) : null;
  const events = demo ? MOCK_ACTIVITY : await getActivity(40, ids ?? undefined);

  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-brand/60 bg-panel2' : 'border-line text-muted hover:text-ink')}>{label}</Link>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {demo && <DemoBanner />}
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Actividad</h1>
        <p className="text-sm text-muted">Qué está pasando ahora en la comunidad. Se actualiza en vivo.</p>
      </header>
      <div className="flex gap-2">
        {tab('/actividad', 'Todo', !following)}
        {tab(me ? '/actividad?filtro=siguiendo' : '/login?next=/actividad%3Ffiltro%3Dsiguiendo', 'Siguiendo', !!following)}
      </div>
      {following && ids?.length === 0 && (
        <p className="text-sm text-muted">Aún no sigues a nadie. Entra al perfil de otros usuarios para seguirlos.</p>
      )}
      <ActivityFeed initial={events} demo={demo} onlyActors={ids} />
    </div>
  );
}
