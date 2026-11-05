import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { AdSlot } from '@/components/ads/AdSlot';
import { TokenCard } from '@/components/token/TokenCard';
import { withTimeout } from '@/lib/cache';
import { getRankings, type RankingEntry, type Rankings } from '@/lib/services/rankings';
import { formatAge } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Ranking de memecoins: las más sonadas, con más volumen y más FOMO',
  description: 'Rankings en vivo de memecoins: las más sonadas, las de más volumen, las nuevas con más FOMO y las clásicas que siguen vivas.',
};
export const revalidate = 60;

const SECTIONS: { id: keyof Omit<Rankings, 'updatedAt'>; title: string; hint: string }[] = [
  { id: 'sonadas', title: '🔥 Las más sonadas ahora', hint: 'Lo que más se está moviendo en la última hora.' },
  { id: 'fomo', title: '🚀 Nuevas con más FOMO', hint: 'Menos de 2 días de vida y mucha más compra que venta.' },
  { id: 'volumen', title: '📈 Más volumen (24 h)', hint: 'Dónde está pasando más dinero.' },
  { id: 'clasicas', title: '🏛️ Clásicas que siguen vivas', hint: 'Más de 14 días y todavía con volumen. Esta lista se renueva cada hora.' },
];

function Ranked({ rows }: { rows: RankingEntry[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Sin datos por ahora; se llena solo en el próximo refresco.</p>;
  return (
    <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r, i) => (
        <li key={`${r.token.chain}:${r.token.address}`} className="relative">
          <span className="absolute -left-1 -top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-bg">{i + 1}</span>
          <TokenCard t={r.token} />
          <p className="mt-1 px-1 text-xs text-muted">{r.note}</p>
        </li>
      ))}
    </ol>
  );
}

export default async function RankingPage() {
  const data = await withTimeout<Rankings | null>(getRankings(), 6_000, null);
  return (
    <div className="space-y-8">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Ranking de memecoins</h1>
        <p className="max-w-2xl text-muted">
          Cuatro listas que se actualizan solas con datos de DexScreener y GeckoTerminal.
          {data && <> Última actualización {formatAge(data.updatedAt)}.</>} ¿Crees que alguna va a durar? <Link href="/predicciones" className="text-brand hover:underline">Haz tu predicción</Link>.
        </p>
      </header>
      {!data && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Las fuentes de datos están lentas. Recarga en unos segundos.</p>}
      {data && SECTIONS.map((s, i) => (
        <Fragment key={s.id}>
          <section className="space-y-3">
            <div><h2 className="font-display text-xl font-semibold">{s.title}</h2><p className="text-sm text-muted">{s.hint}</p></div>
            <Ranked rows={data[s.id]} />
          </section>
          {i === 1 && <AdSlot slot="ranking" />}
        </Fragment>
      ))}
      <p className="text-xs text-muted">Rankings heurísticos, no recomendaciones. Mucha actividad no significa que un token sea seguro.</p>
    </div>
  );
}
