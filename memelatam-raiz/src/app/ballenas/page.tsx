import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { DemoBanner } from '@/components/community/parts';
import { FollowWalletButton } from '@/components/profile/ProfileClient';
import { getMe } from '@/lib/auth';
import { explorerUrl } from '@/lib/chains';
import { ADSENSE } from '@/lib/config';
import { getFollowedWallets } from '@/lib/services/community';
import { getActiveWallets, type ActiveWallet } from '@/lib/services/wallets';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { shortAddress } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Ballenas en movimiento: wallets grandes que están en varias memecoins',
  description: 'Wallets de Solana que aparecen entre los mayores holders de varias memecoins activas. Guárdalas y sigue dónde están.',
};
export const dynamic = 'force-dynamic';

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export default async function BallenasPage() {
  const me = await getMe();
  const [active, saved] = await Promise.all([
    withTimeout<ActiveWallet[]>(getActiveWallets().catch(() => []), 9_000, []),
    me ? getFollowedWallets(me.id, 'solana') : Promise.resolve([] as string[]),
  ]);
  const savedSet = new Set(saved);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Ballenas en movimiento</h1>
        <p className="max-w-2xl text-muted">
          Wallets de Solana que aparecen entre los mayores holders de <strong className="font-medium text-ink">varias</strong> de las memecoins más activas del momento (sin contar los pools de liquidez). Si una wallet grande está en muchos tokens a la vez, vale la pena mirarla.
        </p>
        <p className="rounded-lg border border-line bg-panel/60 p-3 text-xs text-muted">
          Es información, no una señal de compra: <strong>no mostramos ganancias ni “traders ganadores”</strong> porque ese dato no está verificado. Para ver las ballenas de un token en concreto, ábrelo desde el <Link href="/scan" className="text-brand hover:underline">Scan</Link>.
        </p>
      </header>
      {!isSupabaseConfigured && <DemoBanner />}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Aparecen en 2 o más memecoins</h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Calculando o sin coincidencias ahora mismo. Recarga en un minuto: se arma con los datos de holders más recientes.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((w) => (
              <li key={w.address} className="rounded-xl border border-line bg-panel p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>🐋</span>
                  <a href={explorerUrl('solana', w.address) ?? '#'} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:text-brand">{shortAddress(w.address, 6)}</a>
                  {w.insider && <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300">Marcada como insider</span>}
                  <span className="ml-auto text-xs text-muted">{w.tokens.length} memecoins · {w.totalPct.toFixed(1)}% del supply sumado</span>
                  <FollowWalletButton chain="solana" address={w.address} loggedIn={!!me} initiallyFollowing={savedSet.has(w.address)} />
                </div>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {w.tokens.map((t) => (
                    <Link key={t.address} href={`/token/${t.address}?chain=solana`} className="rounded bg-panel2 px-2 py-0.5 text-xs hover:text-brand">{t.symbol} · {t.pct.toFixed(1)}%</Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdSlot slot={ADSENSE.slotRanking} />
    </div>
  );
}
