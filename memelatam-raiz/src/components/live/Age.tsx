'use client';

import { useNow } from '@/lib/hooks/live';
import { formatAge } from '@/lib/utils';

/** "hace 5 min" que se actualiza solo, sin errores de hidratación. */
export function Age({ ts, className }: { ts: number | null; className?: string }) {
  const now = useNow(15_000);
  return (
    <span className={className} suppressHydrationWarning>
      {formatAge(ts, now ?? undefined)}
    </span>
  );
}
