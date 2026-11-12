import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { TokenAvatar } from '@/components/token/TokenCard';
import { AdSlot } from '@/components/ads/AdSlot';
import { ChartPanel } from '@/components/token/ChartPanel';
import { LivePrice, LiveStats } from '@/components/token/LiveMarketViews';
import { LiveTokenProvider } from '@/components/token/LiveTokenProvider';
import { ContractLine } from '@/components/token/ContractLine';
import { LevelsCard } from '@/components/token/LevelsCard';
import { PotentialCard } from '@/components/token/PotentialCard';
import { TeamCard } from '@/components/token/TeamCard';
import { PredictionBox } from '@/components/token/PredictionBox';
import { WhaleImpact } from '@/components/whales/WhaleImpact';
import { TopTraders } from '@/components/token/TopTraders';
import { HolderTable } from '@/components/token/HolderTable';
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
import { ADSENSE, SITE } from '@/lib/config';
import { pairToLive } from '@/lib/live';
import { potentialScore } from '@/lib/potential';
import { getCallsForToken } from '@/lib/services/potential';
import { toWhales, whaleScenarios } from '@/lib/whales';
import { getMyPredictions, getPredictionStats, type MyPrediction } from '@/lib/services/predictions';
import { getTokenFull } from '@/lib/services/token';
import { cn } from '@/lib/utils';
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
  // Ballenas (si hay holders uno a uno) y escenario de potencial de Veltrix.
  const valueUsd = p.marketCap || p.fdv;
  const whaleList = toWhales(t.holders?.holders ?? [], valueUsd, 5);
  const whaleRows = whaleScenarios(whaleList, p.liquidityUsd);
  const pot = potentialScore({
    marketCap: valueUsd,
    liquidityUsd: p.liquidityUsd,
    volume24h: p.volume.h24,
    buys24h: p.txns.h24.buys,
    sells24h: p.txns.h24.sells,
    ageMs: p.pairCreatedAt ? Date.now() - p.pairCreatedAt : null,
    top10Pct: t.holders?.top10Pct ?? null,
    activity: t.activity.status,
  });
  const calls = demo ? [] : await getCallsForToken(t.chain, t.address);
  // Riesgo grave: en ese caso los mensajes de impulso no animan a seguir subiendo.
  const riskReason = t.security?.mintAuthorityActive
    ? 'la autoridad de mint está activa (pueden crear más tokens)'
    : t.security?.freezeAuthorityActive
      ? 'la autoridad de freeze está activa (pueden congelar tu wallet)'
      : (t.holders?.top10Pct ?? 0) > 60
        ? `el top 10 de holders controla ${(t.holders?.top10Pct ?? 0).toFixed(0)}% del supply`
        : t.security?.rugged
          ? 'RugCheck lo marca como rug'
          : null;
  const [predStats, myPreds] = await Promise.all([
    demo ? Promise.resolve({ vive: 0, muere: 0 }) : getPredictionStats(key),
    me && !demo ? getMyPredictions(me.id, key) : Promise.resolve([] as MyPrediction[]),
  ]);

  return (
    <LiveTokenProvider initial={pairToLive(p)} chain={t.chain} address={t.address}>
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
          <div className="mt-2"><ContractLine chain={t.chain} address={t.address} /></div>
        </div>
        <LivePrice />
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

      {!demo && (
        <BoostButton chain={t.chain} address={t.address} symbol={t.symbol} activeTotal={boosts[key] ?? 0} loggedIn={!!me} />
      )}

      {people.length > 0 && (
        <CommunityPeople
          people={people} meId={me?.id ?? null} followingIds={followingIds}
          holderAddresses={t.holders?.holders.map((h) => h.address) ?? []} chain={t.chain} symbol={t.symbol}
        />
      )}

      <LiveStats dex={p.dexId} totalHolders={t.holders?.totalHolders ?? null} />

      <Section title="¿Quién está detrás?">
        <TeamCard chain={t.chain} address={t.address} />
      </Section>

      {/* Gráfico de velas en vivo (con DexScreener como respaldo) */}
      <ChartPanel chain={p.chainId} pairAddress={p.pairAddress} tokenAddress={t.address} symbol={t.symbol} />

      <LevelsCard chain={t.chain} address={t.address} pairAddress={p.pairAddress} symbol={t.symbol} riskReason={riskReason} />

      <PotentialCard symbol={t.symbol} score={pot.score} tier={pot.tier} reasons={pot.reasons} calls={calls} />

      <PredictionBox chain={t.chain} address={t.address} symbol={t.symbol} loggedIn={!!me} demo={demo} stats={predStats} mine={myPreds} />

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

      {whaleList.length > 0 && (
        <Section title="Si venden las ballenas">
          <WhaleImpact chain={t.chain} whales={whaleList} scenarios={whaleRows} />
        </Section>
      )}

      <Section title="Traders más movidos">
        <TopTraders chain={t.chain} pairAddress={p.pairAddress} loggedIn={!!me} followed={followedWallets} canFollow={!demo} />
      </Section>

      <AdSlot slot={ADSENSE.slotToken} />

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
    </LiveTokenProvider>
  );
}
