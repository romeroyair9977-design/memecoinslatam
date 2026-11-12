import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Age } from '@/components/live/Age';
import { SearchBar } from '@/components/search/SearchBar';
import { TokenAvatar } from '@/components/token/TokenCard';
import { cacheSafeAddress, detectAddressKind } from '@/lib/addresses';
import { chainLabel, isSupportedChain } from '@/lib/chains';
import { searchPairs } from '@/lib/services/dexscreener';
import { normName } from '@/lib/xhandle';
import { formatPct, formatPrice, formatUsd } from '@/lib/utils';
import type { Pair } from '@/types/token';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buscar memecoins', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  if (detectAddressKind(q)) redirect(`/token/${q}`);

  let pairs: Pair[] = [];
  let failed = false;
  if (q.length >= 2) {
    try { pairs = await searchPairs(q); } catch { failed = true; }
  }

  // Un resultado por token (el pool con más liquidez) y solo los que de verdad se parecen a lo escrito.
  const needle = normName(q);
  const best = new Map<string, Pair>();
  for (const p of pairs) {
    if (!isSupportedChain(p.chainId) || p.liquidityUsd < 500) continue;
    if (needle && !normName(p.baseToken.symbol).includes(needle) && !normName(p.baseToken.name).includes(needle)) continue;
    const k = `${p.chainId}:${cacheSafeAddress(p.baseToken.address)}`;
    const prev = best.get(k);
    if (!prev || p.liquidityUsd > prev.liquidityUsd) best.set(k, p);
  }
  const results = [...best.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 40);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Buscar memecoins</h1>
        <SearchBar defaultValue={q} />
      </header>

      {q.length < 2 ? (
        <p className="text-muted">Escribe el nombre o el símbolo de una memecoin, o pega su contract address.</p>
      ) : failed ? (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No pudimos consultar DexScreener ahora. Intenta de nuevo en un momento.</p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          No encontramos memecoins con liquidez que se llamen «{q}». Si es muy nueva, puede tardar unos minutos en aparecer; también puedes pegar su contract address.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            {results.length} resultado(s) para «{q}», ordenados por liquidez. Cualquiera puede crear un token con el mismo nombre: antes de comprar, entra al análisis y revisa «¿Quién está detrás?» y el contrato.
          </p>
          <ul className="space-y-2">
            {results.map((p) => (
              <li key={`${p.chainId}:${p.baseToken.address}`}>
                <Link href={`/token/${p.baseToken.address}?chain=${p.chainId}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel p-3 hover:border-brand/60">
                  <TokenAvatar src={p.imageUrl} symbol={p.baseToken.symbol} size={40} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-medium">{p.baseToken.symbol} <span className="text-sm font-normal text-muted">{p.baseToken.name}</span></p>
                    <p className="text-xs text-muted">{chainLabel(p.chainId)} · {p.dexId} · <Age ts={p.pairCreatedAt} /></p>
                  </div>
                  <dl className="grid grid-cols-3 gap-x-5 text-center text-xs">
                    <div><dt className="text-muted">Precio</dt><dd className="font-semibold">{formatPrice(p.priceUsd)}</dd></div>
                    <div><dt className="text-muted">Liquidez</dt><dd className="font-semibold">{formatUsd(p.liquidityUsd)}</dd></div>
                    <div><dt className="text-muted">24h</dt><dd className={p.priceChange.h24 >= 0 ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>{formatPct(p.priceChange.h24)}</dd></div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
