import { SearchBar } from '@/components/search/SearchBar';
import { TokenColumn } from '@/components/dashboard/TokenColumn';
import { TrendingStrip } from '@/components/dashboard/TrendingStrip';
import { ChatEmbed } from '@/components/chat/ChatEmbed';
import { getDashboard } from '@/lib/services/dashboard';
import { formatAge } from '@/lib/utils';

export const revalidate = 60;

export default async function HomePage() {
  // Si las APIs fallan, la home sigue cargando con columnas vacías.
  const dash = await getDashboard().catch(() => null);

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

      {dash && <TrendingStrip tokens={dash.trending} />}

      <section id="dashboard" className="scroll-mt-20">
        {!dash && (
          <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            No pudimos cargar el dashboard (las APIs de datos no respondieron). Recarga en un momento.
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          <TokenColumn title="Recién lanzadas" description="Pools de menos de 24 h con liquidez mínima." tokens={dash?.nuevas ?? []} />
          <TokenColumn title="Con tracción" description="Volumen, liquidez y transacciones sostenidas." tokens={dash?.traccion ?? []} />
          <TokenColumn title="Migrando" description="Graduadas de pump.fun o presentes en varios DEX." tokens={dash?.migrando ?? []} />
        </div>
        {dash && <p className="mt-3 text-xs text-muted">Actualizado {formatAge(dash.updatedAt)}. Clasificación heurística.</p>}
      </section>

      <ChatEmbed />
    </div>
  );
}
