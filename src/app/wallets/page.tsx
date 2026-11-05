import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { DemoBanner } from '@/components/community/parts';
import { FollowWalletButton, TrackedWallets } from '@/components/profile/ProfileClient';
import { getMe } from '@/lib/auth';
import { chainLabel, explorerUrl } from '@/lib/chains';
import { withTimeout } from '@/lib/cache';
import { getActiveWallets, getMyWallets, getPopularWallets, type ActiveWallet } from '@/lib/services/wallets';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { shortAddress } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Wallets en movimiento: guarda y sigue wallets de memecoins',
  description: 'Wallets que aparecen entre los mayores holders de varias memecoins calientes. Guárdalas, agrega las tuyas y sigue sus movimientos.',
};
export const dynamic = 'force-dynamic';

export default async function WalletsPage() {
  const me = await getMe();
  const [active, popular, mine] = await Promise.all([
    withTimeout<ActiveWallet[]>(getActiveWallets(), 10_000, []),
    getPopularWallets(15),
    me ? getMyWallets(me.id) : Promise.resolve([]),
  ]);
  const saved = new Set(mine.map((w) => w.address));
  const demo = !isSupabaseConfigured;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Wallets en movimiento</h1>
        <p className="max-w-2xl text-muted">
          Wallets de Solana que aparecen entre los mayores holders de <strong className="font-medium text-ink">varias</strong> de las memecoins más calientes. Guárdalas para tenerlas a mano, o pega una wallet que todavía no esté en la lista.
        </p>
        <p className="rounded-lg border border-line bg-panel/60 p-3 text-xs text-muted">
          Somos una plataforma de información: <strong>no mostramos ganancias ni “traders ganadores”</strong> porque no tenemos ese dato verificado, y no te decimos qué copiar. Lo que sí medimos es quién acierta dentro de la comunidad en <Link href="/predicciones" className="text-brand hover:underline">Predicciones</Link>.
        </p>
      </header>
      {demo && <DemoBanner />}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Mis wallets guardadas</h2>
        {me ? <TrackedWallets userId={me.id} initial={mine} /> : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted"><Link href="/login?next=/wallets" className="text-brand hover:underline">Inicia sesión</Link> para guardar wallets y agregar las tuyas. Solo tú las ves.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Aparecen en varias memecoins calientes</h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Calculando o sin coincidencias ahora mismo. Recarga en un minuto: se arma con los datos de holders más recientes.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((w) => (
              <li key={w.address} className="rounded-xl border border-line bg-panel p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={explorerUrl('solana', w.address) ?? '#'} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:text-brand">{shortAddress(w.address, 6)}</a>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{chainLabel('solana')}</span>
                  {w.insider && <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300">Marcada como insider</span>}
                  <span className="ml-auto text-xs text-muted">{w.tokens.length} memecoins · {w.totalPct.toFixed(1)}% del supply sumado</span>
                  <FollowWalletButton chain="solana" address={w.address} loggedIn={!!me} initiallyFollowing={saved.has(w.address)} />
                </div>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {w.tokens.map((t) => <Link key={t.address} href={`/token/${t.address}?chain=solana`} className="rounded bg-panel2 px-2 py-0.5 text-xs hover:text-brand">{t.symbol} · {t.pct.toFixed(1)}%</Link>)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdSlot slot="ranking" />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Las más guardadas por la comunidad</h2>
        {popular.length === 0 ? (
          <p className="text-sm text-muted">Cuando la gente guarde wallets, las más populares aparecen aquí (solo el conteo, nunca quién las guardó).</p>
        ) : (
          <ul className="space-y-1.5">
            {popular.map((w) => (
              <li key={`${w.chain}:${w.address}`} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2.5 text-sm">
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{chainLabel(w.chain)}</span>
                <a href={explorerUrl(w.chain, w.address) ?? '#'} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:text-brand">{shortAddress(w.address, 6)}</a>
                <span className="ml-auto text-xs text-muted">{w.savers} {w.savers === 1 ? 'persona la guardó' : 'personas la guardaron'}</span>
                <FollowWalletButton chain={w.chain} address={w.address} loggedIn={!!me} initiallyFollowing={saved.has(w.address)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
