import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { DemoBanner } from '@/components/community/parts';
import { Leaderboard } from '@/components/predictions/Leaderboard';
import { PredictionForm } from '@/components/predictions/PredictionForm';
import { getMe } from '@/lib/auth';
import { CATEGORIES, categoryLabel, HORIZONS, horizonLabel, type LeaderRow, type PredictionRow } from '@/lib/predictions';
import { getLeaderboard, getRecentPredictions, getUserPredictions, resolveDuePredictions } from '@/lib/services/predictions';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Predicciones: ¿cuánto va a perdurar esta memecoin?',
  description: 'Predice cuánto sobrevive una memecoin y compite en el ranking de los que más aciertan. Gana $LATAM por acertar a largo plazo.',
};
export const dynamic = 'force-dynamic';

const STATUS = { pending: ['En curso', 'text-sky-300'], hit: ['Acertó', 'text-emerald-300'], miss: ['Falló', 'text-rose-400'] } as const;

function PredictionList({ rows, showUser }: { rows: PredictionRow[]; showUser?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted">Nada por aquí todavía.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((p) => {
        const [label, cls] = STATUS[p.status];
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel p-2.5 text-sm">
            {showUser && p.profiles && <Link href={`/perfil/${p.profiles.username}`} className="font-medium hover:text-brand">@{p.profiles.username}</Link>}
            <span>{p.side === 'vive' ? '🚀 vive' : '💀 muere'}</span>
            {p.tokens ? <Link href={`/token/${p.tokens.address}?chain=${p.tokens.chain}`} className="font-medium text-brand hover:underline">{p.tokens.symbol}</Link> : <span>token</span>}
            <span className="text-muted">· {horizonLabel(p.horizon_days)} · {categoryLabel(p.category)}</span>
            <span className={cn('ml-auto text-xs font-medium', cls)}>{label}{p.status === 'hit' ? ` +${p.reward} $LATAM` : p.status === 'pending' ? ` · vence ${new Date(p.due_at).toLocaleDateString('es')}` : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PredictionsPage({ searchParams }: { searchParams: { token?: string; chain?: string } }) {
  const enabled = isSupabaseConfigured;
  const me = await getMe();
  if (enabled) await resolveDuePredictions().catch(() => 0);

  const ids = ['all', ...CATEGORIES.map((c) => c.id)];
  const [boardList, recent, mine] = await Promise.all([
    Promise.all(ids.map((id) => getLeaderboard(id))),
    getRecentPredictions(10),
    me ? getUserPredictions(me.id) : Promise.resolve([] as PredictionRow[]),
  ]);
  const boards: Record<string, LeaderRow[]> = Object.fromEntries(ids.map((id, i) => [id, boardList[i]]));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">¿Cuánto va a perdurar esta memecoin?</h1>
        <p className="max-w-2xl text-muted">
          Aquí no decimos qué comprar: medimos quién sabe leer el mercado. Apuesta a que una memecoin seguirá viva (o morirá) en un plazo; cuando vence, se revisa sola con datos reales y, si acertaste, ganas $LATAM.
          Cuanto más largo el plazo, mayor el premio.
        </p>
        <ul className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
          {HORIZONS.map((h) => <li key={h.days} className="rounded-full border border-line px-2.5 py-1">{h.label}: <span className="text-brand">+{h.reward} $LATAM</span></li>)}
          <li className="rounded-full border border-line px-2.5 py-1">Apostar a que muere paga la mitad</li>
        </ul>
      </header>
      {!enabled && <DemoBanner />}

      <PredictionForm loggedIn={!!me} enabled={enabled} initialAddress={searchParams.token} initialChain={searchParams.chain} />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Ranking de los que más aciertan</h2>
        <Leaderboard boards={boards} />
      </section>

      <AdSlot slot="ranking" />

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-3"><h2 className="font-display text-lg font-semibold">Predicciones recientes</h2><PredictionList rows={recent} showUser /></section>
        <section className="space-y-3"><h2 className="font-display text-lg font-semibold">Tus predicciones</h2>{me ? <PredictionList rows={mine} /> : <p className="text-sm text-muted"><Link href="/login?next=/predicciones" className="text-brand hover:underline">Inicia sesión</Link> para ver las tuyas.</p>}</section>
      </div>
      <p className="text-xs text-muted">“Viva” al vencer = liquidez ≥ $5K y volumen 24 h ≥ $1K. Máximo 5 predicciones por día y una por token. No es asesoría financiera: no se arriesga dinero, solo $LATAM que se gana acertando.</p>
    </div>
  );
}
