import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { AdSlot } from '@/components/ads/AdSlot';
import { TokenCard } from '@/components/token/TokenCard';
import { ADSENSE } from '@/lib/config';
import { getRankings, type RankingEntry, type RankingId, type Rankings } from '@/lib/services/rankings';
import { formatAge } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Scan de memecoins: cuáles tienen vida, cuáles están muertas y cuáles explotan',
  description: 'Ranking en vivo de memecoins: con vida, poca actividad, boom de 24 h, proyectos muertos, las más sonadas, FOMO, volumen y clásicas. Revisa antes de invertir.',
};
export const dynamic = 'force-dynamic';

const SECTIONS: { id: RankingId; title: string; hint: string }[] = [
  { id: 'vivas', title: '🟢 Con vida', hint: 'Transacciones reales, volumen y liquidez de al menos $10K. Las que más se mueven primero.' },
  { id: 'boom', title: '🚀 Boom en 24 h', hint: 'Subieron 100 % o más con volumen. Pueden ser pumps: revisa holders y ballenas antes de entrar.' },
  { id: 'pocaActividad', title: '🟡 Poca actividad', hint: 'Todavía respiran, pero con pocas transacciones. Cuidado con la liquidez.' },
  { id: 'muertas', title: '💀 Proyectos muertos', hint: 'Más de 12 horas de vida y señales de abandono: caída fuerte, sin transacciones o sin liquidez.' },
  { id: 'sonadas', title: '🔥 Las más sonadas ahora', hint: 'Lo que más se está moviendo en la última hora.' },
  { id: 'fomo', title: '🛒 Nuevas con más FOMO', hint: 'Menos de 2 días de vida y mucha más compra que venta.' },
  { id: 'volumen', title: '📈 Más volumen (24 h)', hint: 'Dónde está pasando más dinero.' },
  { id: 'clasicas', title: '🏛️ Clásicas que siguen vivas', hint: 'Más de 14 días y todavía con volumen. Esta lista se renueva cada hora.' },
];

function Ranked({ rows }: { rows: RankingEntry[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Ninguna coincide ahora mismo. Se actualiza sola con cada refresco.</p>;
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

/** Si las fuentes tardan, no bloquea la página: muestra el aviso y pide recargar. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export default async function ScanPage() {
  const data = await withTimeout<Rankings | null>(getRankings().catch(() => null), 9_000, null);
  return (
    <div className="space-y-8">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Scan de memecoins</h1>
        <p className="max-w-3xl text-muted">
          Todo en un solo sitio para decidir con información: qué memecoins tienen vida, cuáles están muertas, cuáles explotaron en 24 h y quién las mueve.
          Toca cualquier token para ver su contrato, gráfica, holders y ballenas.
          {data && <> Última actualización {formatAge(data.updatedAt)}.</>}
        </p>
        <p className="flex flex-wrap gap-2 pt-1 text-sm">
          <Link href="/potencial" className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-brand hover:bg-brand/20">🎯 Radar x10 · x100 · x1000</Link>
          <Link href="/ballenas" className="rounded-full border border-line px-3 py-1 text-muted hover:text-ink">🐋 Ballenas en movimiento</Link>
          <Link href="/tendencias-x" className="rounded-full border border-line px-3 py-1 text-muted hover:text-ink">𝕏 Tendencias en X</Link>
          <Link href="/ranking" className="rounded-full border border-line px-3 py-1 text-muted hover:text-ink">🏆 Ranking de predictores</Link>
        </p>
      </header>

      {data && (
        <nav aria-label="Secciones" className="flex gap-2 overflow-x-auto pb-1 text-sm">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full border border-line px-3 py-1 text-muted hover:text-ink">{s.title}</a>
          ))}
        </nav>
      )}

      {!data && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Las fuentes de datos están lentas. Recarga en unos segundos.</p>}

      {data && SECTIONS.map((s, i) => (
        <Fragment key={s.id}>
          <section id={s.id} className="scroll-mt-32 space-y-3">
            <div><h2 className="font-display text-xl font-semibold">{s.title}</h2><p className="text-sm text-muted">{s.hint}</p></div>
            <Ranked rows={data[s.id]} />
          </section>
          {i === 3 && <AdSlot slot={ADSENSE.slotRanking} />}
        </Fragment>
      ))}

      <p className="text-xs text-muted">Rankings heurísticos sobre los tokens que el scan encontró (con al menos $1K de liquidez). No son recomendaciones de inversión: mucha actividad no significa que un token sea seguro, y una caída no siempre es abandono.</p>
    </div>
  );
}
