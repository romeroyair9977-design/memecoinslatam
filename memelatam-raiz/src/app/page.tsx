import Link from 'next/link';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { CommunityList } from '@/components/community/parts';
import { SearchBar } from '@/components/search/SearchBar';
import { AdSlot } from '@/components/ads/AdSlot';
import { ADSENSE } from '@/lib/config';
import { LiveDashboard } from '@/components/dashboard/LiveDashboard';
import { MOCK_ACTIVITY, MOCK_MESSAGES, MOCK_TOP_COMMUNITIES } from '@/lib/mock';
import { getDashboard } from '@/lib/services/dashboard';
import { getActiveBoosts, getActivity, getGeneralCommunity, getMemberCounts, getMessages, getTopCommunities } from '@/lib/services/community';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { formatAge } from '@/lib/utils';
import { tokenKey } from '@/types/community';

export const revalidate = 20;

export default async function HomePage() {
  // Si las APIs fallan, la home sigue cargando con columnas vacías.
  const dash = await getDashboard().catch(() => null);
  const demo = !isSupabaseConfigured;

  // Todo lo social usa el cliente público (sin cookies) para que la home siga siendo ISR.
  const keys = dash ? dash.tokens.map((t) => tokenKey(t.chain, t.address)) : [];
  const [memberCounts, boosts, general, top, activity] = await Promise.all([
    getMemberCounts(keys),
    getActiveBoosts(),
    getGeneralCommunity(),
    demo ? Promise.resolve(MOCK_TOP_COMMUNITIES) : getTopCommunities(5),
    demo ? Promise.resolve(MOCK_ACTIVITY) : getActivity(6),
  ]);
  const latest = demo ? MOCK_MESSAGES.general.slice(-4) : general ? (await getMessages(general.id, 'general', 4)) : [];

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-2xl pt-6 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Antes de comprar, mira quién tiene los tokens
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Pega un contract address y revisa liquidez, concentración de holders y señales de rug. Luego discute tu tesis con la comunidad latina.
        </p>
        <div className="mt-6"><SearchBar /></div>
      </section>

      <LiveDashboard initial={dash} memberCounts={demo ? undefined : memberCounts} boosts={demo ? undefined : boosts} />

      <AdSlot slot={ADSENSE.slotHome} />

      <section id="comunidad" className="scroll-mt-20 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Comunidad General</h2>
            <Link href="/comunidad" className="text-sm text-brand hover:underline">Entrar al chat →</Link>
          </div>
          {latest.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Todavía no hay mensajes. Sé quien abra la conversación.</p>
          ) : (
            <ul className="space-y-2">
              {latest.map((m) => (
                <li key={m.id} className="rounded-xl border border-line bg-panel p-3 text-sm">
                  <p className="mb-0.5 text-xs text-muted"><span className="font-medium text-ink">@{m.author?.username ?? 'anónimo'}</span> · {formatAge(new Date(m.created_at).getTime())}</p>
                  <p className="line-clamp-2 break-words">{m.deleted_at ? 'Mensaje eliminado' : m.body}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/comunidad" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:bg-brand-dim">Unirme a la conversación</Link>
        </div>
        <aside className="space-y-4">
          <CommunityList communities={top} title="Comunidades más activas" />
          <section className="rounded-xl border border-line bg-panel/50 p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Actividad</h2>
            <ActivityFeed initial={activity} compact demo={demo} />
          </section>
        </aside>
      </section>
    </div>
  );
}
