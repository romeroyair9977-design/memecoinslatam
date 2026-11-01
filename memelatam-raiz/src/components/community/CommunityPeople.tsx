import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { FollowUserButton } from '@/components/profile/ProfileClient';
import type { CommunityPerson } from '@/types/community';

interface Props {
  people: CommunityPerson[];
  meId: string | null;
  followingIds: string[];
  /** Direcciones del top de holders del token; si la wallet de una persona coincide, se marca. */
  holderAddresses: string[];
  chain: string;
  symbol: string;
}

const norm = (a: string) => (a.startsWith('0x') ? a.toLowerCase() : a);

/** Gente de la comunidad del token. Quien entró con wallet y es holder real se marca como verificado. */
export function CommunityPeople({ people, meId, followingIds, holderAddresses, symbol }: Props) {
  const holders = new Set(holderAddresses.map(norm));
  const sorted = [...people].sort((a, b) => Number(isHolder(b)) - Number(isHolder(a)));
  function isHolder(p: CommunityPerson) { return !!p.wallet_address && holders.has(norm(p.wallet_address)); }

  return (
    <section className="rounded-xl border border-line bg-panel/50 p-4">
      <h2 className="mb-1 font-display text-lg font-semibold">Gente en {symbol}</h2>
      <p className="mb-3 text-sm text-muted">Entra con tu wallet para aparecer aquí como holder verificado. Sigue a quien te interese y te avisamos de sus tesis.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel2 text-xs font-semibold uppercase text-muted" aria-hidden>{p.username.slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <Link href={`/perfil/${p.username}`} className="block truncate text-sm font-medium hover:underline">@{p.username}</Link>
              <p className="flex flex-wrap gap-1 text-xs">
                {isHolder(p) && <span className="inline-flex items-center gap-1 text-emerald-300"><BadgeCheck className="h-3 w-3" aria-hidden />Holder verificado</span>}
                {p.role === 'mod' && <span className="text-brand">Moderador</span>}
              </p>
            </div>
            {p.id !== meId && <FollowUserButton targetId={p.id} meId={meId} initiallyFollowing={followingIds.includes(p.id)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
