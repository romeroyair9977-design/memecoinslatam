'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Users } from 'lucide-react';
import { joinTokenCommunity, leaveCommunity } from '@/app/actions/community';
import { cn } from '@/lib/utils';

interface Props {
  chain: string;
  address: string;
  loggedIn: boolean;
  /** null = la comunidad todavía no existe */
  communityId: string | null;
  isMember: boolean;
  memberCount: number;
  /** 'big' = CTA del detalle del token; 'compact' = dentro de la sala */
  variant?: 'big' | 'compact';
  /** Si es true, tras unirse navega a la sala. */
  goToRoomAfterJoin?: boolean;
}

export function JoinCommunityButton({ chain, address, loggedIn, communityId, isMember, memberCount, variant = 'big', goToRoomAfterJoin }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const room = `/comunidad/${chain}/${address}`;

  function go() {
    if (isMember && goToRoomAfterJoin) return router.push(room);
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(room)}`);
    setError(null);
    start(async () => {
      const res = isMember && communityId ? await leaveCommunity(communityId) : await joinTokenCommunity(chain, address);
      if (!res.ok) {
        if (res.needsLogin) return router.push(`/login?next=${encodeURIComponent(room)}`);
        return setError(res.error);
      }
      if (goToRoomAfterJoin && !isMember) router.push(room);
      else router.refresh();
    });
  }

  const label = pending
    ? 'Un momento…'
    : isMember
      ? goToRoomAfterJoin ? 'Ir a la comunidad' : 'Salir de la comunidad'
      : communityId ? 'Unirse a la comunidad de este token' : 'Crear la comunidad de este token';

  return (
    <div className={cn(variant === 'big' ? 'w-full sm:w-auto' : '')}>
      <button
        onClick={go}
        disabled={pending}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium disabled:opacity-60',
          variant === 'big' ? 'w-full px-5 py-3 text-base sm:w-auto' : 'px-3 py-1.5 text-sm',
          isMember && !goToRoomAfterJoin ? 'border border-line text-muted hover:text-ink' : 'bg-brand text-bg hover:bg-brand-dim',
        )}
      >
        <Users className="h-4 w-4" aria-hidden />
        {label}
        {variant === 'big' && communityId && <span className="rounded-full bg-bg/20 px-2 py-0.5 text-xs">{memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}</span>}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
