import type { Metadata } from 'next';
import Link from 'next/link';
import { ChatRoom } from '@/components/community/ChatRoom';
import { JoinCommunityButton } from '@/components/community/JoinCommunityButton';
import { ChannelTabs, DemoBanner } from '@/components/community/parts';
import { SearchBar } from '@/components/search/SearchBar';
import { TokenAvatar } from '@/components/token/TokenCard';
import { ActivityBadge, RiskBadge } from '@/components/token/RiskBadge';
import { getMe } from '@/lib/auth';
import { chainLabel, isSupportedChain } from '@/lib/chains';
import { MOCK_MESSAGES } from '@/lib/mock';
import { getMessages, getModerators, getRole, getTokenCommunity } from '@/lib/services/community';
import { getTokenFull } from '@/lib/services/token';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { cn, formatPct, formatPrice, formatUsd } from '@/lib/utils';
import { TOKEN_CHANNELS, tokenKey } from '@/types/community';

interface Props {
  params: { chain: string; address: string };
  searchParams: { canal?: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await getTokenFull(decodeURIComponent(params.address), params.chain);
  if (res.status !== 'ok') return { title: 'Comunidad no encontrada', robots: { index: false } };
  return {
    title: `Comunidad de ${res.token.symbol}`,
    description: `Chat y tesis de la comunidad latina de ${res.token.name} (${res.token.symbol}) en ${chainLabel(res.token.chain)}.`,
  };
}

export default async function TokenCommunityPage({ params, searchParams }: Props) {
  const address = decodeURIComponent(params.address);
  const demo = !isSupabaseConfigured;

  if (!isSupportedChain(params.chain)) {
    return <Empty title="Red no soportada" body="Usa una de las redes que analizamos: Solana, Ethereum, Base, BNB Chain, Arbitrum, Polygon o Avalanche." />;
  }
  const res = await getTokenFull(address, params.chain);
  if (res.status !== 'ok') {
    return <Empty title="No encontramos este token" body="Verifica el contrato. Si es muy nuevo, puede tardar unos minutos en aparecer en DexScreener." />;
  }

  const t = res.token;
  const key = tokenKey(t.chain, t.address);
  const channel = TOKEN_CHANNELS.find((c) => c.id === searchParams.canal)?.id ?? 'chat';
  const me = await getMe();
  const community = demo ? null : await getTokenCommunity(key);
  const role = me && community ? await getRole(community.id, me.id) : null;
  const [messages, mods] = await Promise.all([
    community ? getMessages(community.id, channel) : Promise.resolve([]),
    community ? getModerators(community.id) : Promise.resolve([]),
  ]);
  const isMember = role !== null;
  const base = `/comunidad/${t.chain}/${t.address}`;
  const up = t.pair.priceChange.h24 >= 0;

  return (
    <div className="space-y-4">
      {demo && <DemoBanner />}
      <header className="flex flex-wrap items-center gap-4">
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">Comunidad de {t.symbol}</h1>
          <p className="text-sm text-muted">
            {t.name} · {chainLabel(t.chain)} · {community ? `${community.member_count} ${community.member_count === 1 ? 'miembro' : 'miembros'}` : 'sin comunidad todavía'}
          </p>
        </div>
        <JoinCommunityButton
          chain={t.chain} address={t.address} loggedIn={!!me} communityId={community?.id ?? null}
          isMember={isMember} memberCount={community?.member_count ?? 0} variant="compact"
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-3">
          {demo ? (
            <ChatRoom communityId="demo" channel="chat" initial={MOCK_MESSAGES.general.slice(0, 4)} me={null} canWrite={false} isMod={false} demo />
          ) : !community ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center">
              <h2 className="font-display text-lg font-semibold">Nadie ha abierto esta comunidad</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">Crea la comunidad de {t.symbol}: los tres primeros miembros serán moderadores.</p>
              <div className="mt-4 flex justify-center">
                <JoinCommunityButton chain={t.chain} address={t.address} loggedIn={!!me} communityId={null} isMember={false} memberCount={0} />
              </div>
            </div>
          ) : (
            <>
              <ChannelTabs base={base} channels={TOKEN_CHANNELS} active={channel} />
              <ChatRoom
                communityId={community.id}
                channel={channel}
                initial={messages}
                me={me ? { id: me.id, username: me.username, isAdmin: me.is_admin } : null}
                canWrite={!!me && isMember}
                isMod={role === 'mod' || !!me?.is_admin}
                placeholder={channel === 'posts' ? `Comparte tu análisis o tesis sobre ${t.symbol}…` : `Habla de ${t.symbol}…`}
                lockedNotice={
                  me
                    ? <>Únete a la comunidad para escribir.</>
                    : <><Link href={`/login?next=${encodeURIComponent(base)}`} className="text-brand hover:underline">Inicia sesión</Link> y únete para escribir.</>
                }
              />
            </>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-panel/50 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-base font-semibold">Resumen</h2>
              <Link href={`/token/${t.address}?chain=${t.chain}`} className="text-sm text-brand hover:underline">Análisis completo →</Link>
            </div>
            <p className="mt-2 text-2xl font-semibold">{formatPrice(t.pair.priceUsd)}</p>
            <p className={cn('text-sm font-medium', up ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(t.pair.priceChange.h24)} en 24h</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-muted">Liquidez</dt><dd>{formatUsd(t.pair.liquidityUsd)}</dd></div>
              <div><dt className="text-muted">Vol 24h</dt><dd>{formatUsd(t.pair.volume.h24)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2"><RiskBadge level={t.risk.level} score={t.risk.score} /><ActivityBadge status={t.activity.status} /></div>
          </section>
          <section className="rounded-xl border border-line bg-panel/50 p-4 text-sm">
            <h2 className="mb-2 font-display text-base font-semibold">Moderación</h2>
            {mods.length ? (
              <p className="text-muted">Moderan: {mods.map((m, i) => <span key={m.username}>{i > 0 && ', '}<Link href={`/perfil/${m.username}`} className="text-ink hover:underline">@{m.username}</Link></span>)}</p>
            ) : <p className="text-muted">Aún sin moderadores.</p>}
            <p className="mt-2 text-xs text-muted">Reporta mensajes con la bandera. Nadie del equipo te pedirá tu seed phrase: es una estafa.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="text-muted">{body}</p>
      <SearchBar />
    </div>
  );
}
