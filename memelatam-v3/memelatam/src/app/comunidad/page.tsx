import type { Metadata } from 'next';
import Link from 'next/link';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { ChatRoom } from '@/components/community/ChatRoom';
import { ChannelTabs, CommunityList, DemoBanner } from '@/components/community/parts';
import { getMe } from '@/lib/auth';
import { MOCK_ACTIVITY, MOCK_GENERAL, MOCK_MESSAGES, MOCK_TOP_COMMUNITIES } from '@/lib/mock';
import { getActivity, getGeneralCommunity, getMessages, getTopCommunities } from '@/lib/services/community';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { GENERAL_CHANNELS } from '@/types/community';

export const metadata: Metadata = {
  title: 'Comunidad General',
  description: 'Chat y feed en tiempo real de la comunidad latina de memecoins: tesis, señales, rugs y nuevas.',
};
export const dynamic = 'force-dynamic';

export default async function GeneralCommunityPage({ searchParams }: { searchParams: { canal?: string } }) {
  const channel = GENERAL_CHANNELS.find((c) => c.id === searchParams.canal)?.id ?? 'general';
  const demo = !isSupabaseConfigured;
  const me = await getMe();

  const community = demo ? MOCK_GENERAL : await getGeneralCommunity();
  const [messages, top, activity] = await Promise.all([
    demo ? Promise.resolve(MOCK_MESSAGES[channel] ?? []) : community ? getMessages(community.id, channel) : Promise.resolve([]),
    demo ? Promise.resolve(MOCK_TOP_COMMUNITIES) : getTopCommunities(6),
    demo ? Promise.resolve(MOCK_ACTIVITY) : getActivity(6),
  ]);

  if (!community) {
    return (
      <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        No encontramos la comunidad general. ¿Ejecutaste <code>supabase/migrations/0001_init.sql</code>?
      </p>
    );
  }

  const tab = GENERAL_CHANNELS.find((c) => c.id === channel)!;

  return (
    <div className="space-y-4">
      {demo && <DemoBanner />}
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{community.name}</h1>
        <p className="text-sm text-muted">{community.description} · {community.member_count.toLocaleString('es')} miembros</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          <ChannelTabs base="/comunidad" channels={GENERAL_CHANNELS} active={channel} />
          <p className="text-xs text-muted">#{tab.label.toLowerCase()} · {tab.hint}. Pega un contrato y se vuelve un link al análisis.</p>
          <ChatRoom
            communityId={community.id}
            channel={channel}
            initial={messages}
            me={me ? { id: me.id, username: me.username, isAdmin: me.is_admin } : null}
            canWrite={!!me}
            isMod={!!me?.is_admin}
            demo={demo}
            placeholder={channel === 'rugs' ? 'Avisa de un posible rug con datos (contrato, holders, mint)…' : undefined}
            lockedNotice={<>Para escribir <Link href="/login?next=/comunidad" className="text-brand hover:underline">inicia sesión</Link> con tu wallet o correo.</>}
          />
        </div>
        <aside className="space-y-4">
          <CommunityList communities={top} />
          <section className="rounded-xl border border-line bg-panel/50 p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Actividad reciente</h2>
            <ActivityFeed initial={activity} compact demo={demo} />
            <Link href="/actividad" className="mt-3 block text-sm text-brand hover:underline">Ver toda la actividad →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
