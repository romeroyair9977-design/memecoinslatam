import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { AdSlot } from '@/components/ads/AdSlot';
import { SearchBar } from '@/components/search/SearchBar';
import { TokenAvatar } from '@/components/token/TokenCard';
import { TokenStats } from '@/components/token/TokenStats';
import { HolderTable } from '@/components/token/HolderTable';
import { ContractChip } from '@/components/token/ContractChip';
import { PriceChart } from '@/components/token/PriceChart';
import { NewsFeed } from '@/components/token/NewsFeed';
import { ThesisSection } from '@/components/token/ThesisSection';
import { JoinCommunityButton } from '@/components/community/JoinCommunityButton';
import { CommunityPeople } from '@/components/community/CommunityPeople';
import { BoostButton } from '@/components/latam/BoostButton';
import { ActivityBadge, RiskBadge } from '@/components/token/RiskBadge';
import { getMe } from '@/lib/auth';
import { chainLabel } from '@/lib/chains';
import { MOCK_THESES } from '@/lib/mock';
import { getActiveBoosts, getCommunityPeople, getFollowedWallets, getFollowingIds, getRole, getTheses, getTokenCommunity } from '@/lib/services/community';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { SITE } from '@/lib/config';
import { getTokenFull } from '@/lib/services/token';
import { cn, formatPct, formatPrice } from '@/lib/utils';
import type { RiskFlag } from '@/types/token';
import { tokenKey } from '@/types/community';

interface Props {
  params: { address: string };
  searchParams: { chain?: string };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const res = await getTokenFull(decodeURIComponent(params.address), searchParams.chain);
  if (res.status !== 'ok') return { title: 'Token no encontrado', robots: { index: false } };
  const t = res.token;
  const title = `${t.symbol} (${t.name}): precio, holders y riesgo`;
  const description = `Analiza ${t.name} en ${chainLabel(t.chain)}: liquidez, concentración de holders, señales de rug y tesis de la comunidad latina en ${SITE.name}.`;
  return { title, description, openGraph: { title, description } };
}

const FLAG_ICON: Record<RiskFlag['severity'], { Icon: typeof Info; cls: string }> = {
  danger: { Icon: ShieldAlert, cls: 'text-rose-400' },
  warn: { Icon: AlertTriangle, cls: 'text-amber-400' },
  info: { Icon: Info, cls: 'text-sky-400' },
  ok: { Icon: CheckCircle2, cls: 'text-emerald-400' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel/50 p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="text-muted">{body}</p>
      <SearchBar />
    </div>
  );
}

export default async function TokenPage({ params, searchParams }: Props) {
  const address = decodeURIComponent(params.address);
  const res = await getTokenFull(address, searchParams.chain);

  if (res.status === 'invalid')
    return <Message title="Esa dirección no parece válida" body="Revisa que esté completa. Solana usa 32–44 caracteres; las redes EVM empiezan con 0x y tienen 42." />;
  if (res.status === 'not_found')
    return <Message title="No encontramos este token" body="No tiene pools con liquidez en las redes que soportamos, o es demasiado nuevo para estar indexado. Prueba de nuevo en unos minutos." />;
  if (res.status === 'error')
    return <Message title="Los datos no están disponibles" body={res.message} />;

  const t = res.token;
  const p = t.pair;
  const up = p.priceChange.h24 >= 0;

  // Capa social (en modo demo todo queda vacío / mock y no se toca Supabase)
  const demo = !isSupabaseConfigured;
  const key = tokenKey(t.chain, t.address);
  const me = await getMe();
  const [community, theses, followedWallets, boosts, followingIds] = await Promise.all([
    getTokenCommunity(key),
    demo ? Promise.resolve(MOCK_THESES) : getTheses(key),
    me ? getFollowedWallets(me.id, t.chain) : Promise.resolve([] as string[]),
    demo ? Promise.resolve({} as Record<string, number>) : getActiveBoosts(),
    me ? getFollowingIds(me.id) : Promise.resolve([] as string[]),
  ]);
  const role = me && community ? await getRole(community.id, me.id) : null;
  const people = community ? await getCommunityPeople(community.id) : [];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <header className="flex flex-wrap items-center gap-4">
        <TokenAvatar src={t.imageUrl} symbol={t.symbol} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {t.symbol} <span className="text-lg font-normal text-muted">{t.name}</span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{chainLabel(t.chain)}</span>
            <RiskBadge level={t.risk.level} score={t.risk.score} />
            <ActivityBadge status={t.activity.status} />
          </div>
          <ContractChip chain={t.chain} address={t.address} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{formatPrice(p.priceUsd)}</p>
          <p className={cn('text-sm font-medium', up ? 'text-emerald-400' : 'text-rose-400')}>{formatPct(p.priceChange.h24)} en 24h</p>
        </div>
      </header>

      {t.alternativeChains.length > 0 && (
        <p className="rounded-lg border border-line bg-panel p-3 text-sm text-muted">
          Esta dirección también existe en otras redes:{' '}
          {t.alternativeChains.map((c) => (
            <Link key={c.chain} href={`/token/${t.address}?chain=${c.chain}`} className="mr-2 text-brand hover:underline">{chainLabel(c.chain)}</Link>
          ))}
        </p>
      )}

      {/* CTA principal: comunidad del token */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Comunidad de {t.symbol}</h2>
          <p className="text-sm text-muted">
            {community
              ? `${community.member_count} ${community.member_count === 1 ? 'persona' : 'personas'} hablando de este token. Chat en vivo, posts y tesis.`
              : 'Aún no existe. Crea la comunidad: los tres primeros miembros serán moderadores.'}
          </p>
        </div>
        <JoinCommunityButton
          chain={t.chain} address={t.address} loggedIn={!!me} communityId={community?.id ?? null}
          isMember={role !== null} memberCount={community?.member_count ?? 0} goToRoomAfterJoin
        />
      </section>

      <p className="text-sm text-muted">
        ¿Crees que {t.symbol} va a durar? <Link href={`/predicciones?token=${t.address}&chain=${t.chain}`} className="text-brand hover:underline">Haz tu predicción y gana $LATAM si aciertas →</Link>
      </p>

      {/* Anuncio: justo después de la acción principal y antes del análisis largo; no interrumpe ningún dato. */}
      <AdSlot slot="token" minHeight={120} />

      {!demo && (
        <BoostButton chain={t.chain} address={t.address} symbol={t.symbol} activeTotal={boosts[key] ?? 0} loggedIn={!!me} />
      )}

      {people.length > 0 && (
        <CommunityPeople
          people={people} meId={me?.id ?? null} followingIds={followingIds}
          holderAddresses={t.holders?.holders.map((h) => h.address) ?? []} chain={t.chain} symbol={t.symbol}
        />
      )}

      <TokenStats pair={p} totalHolders={t.holders?.totalHolders ?? null} />

      {/* Gráfico propio: velas + compras/ventas reales del pool dibujadas como burbujas */}
      <PriceChart
        chain={t.chain}
        pool={p.pairAddress}
        token={t.address}
        symbol={t.symbol}
        holderAddresses={t.holders?.holders.map((h) => h.address) ?? []}
        totalHolders={t.holders?.totalHolders ?? null}
        advancedSrc={`https://dexscreener.com/${p.chainId}/${p.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Riesgo y señales">
          <ul className="space-y-3">
            {t.risk.flags.map((f) => {
              const { Icon, cls } = FLAG_ICON[f.severity];
              return (
                <li key={f.id} className="flex gap-3">
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls)} aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-sm text-muted">{f.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">Un riesgo bajo no significa que sea seguro. Es una heurística, no una garantía.</p>
        </Section>

        <Section title="Holders">
          <HolderTable stats={t.holders} chain={t.chain} social={demo ? undefined : { loggedIn: !!me, followed: followedWallets }} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t.activity.status === 'fantasma' ? 'Actividad: token fantasma' : 'Actividad y noticias'}>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
            {t.activity.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <NewsFeed symbol={t.symbol} name={t.name} address={t.address} links={t.links} />
        </Section>

        <Section title="Tesis de la comunidad">
          <ThesisSection chain={t.chain} address={t.address} initial={theses} loggedIn={!!me} demo={demo} />
        </Section>
      </div>

      <p className="text-xs text-muted">
        Datos de DexScreener{t.info ? ', GeckoTerminal' : ''}{t.security ? ' y RugCheck' : ''}.{' '}
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">Ver en DexScreener</a>
      </p>
    </div>
  );
}
