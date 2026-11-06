'use client';

import { useEffect, useRef, useState } from 'react';
import { cn, formatNumber, formatPct, formatPrice, formatUsd } from '@/lib/utils';

type Kind = 'price' | 'usd' | 'pct' | 'int';
const FMT: Record<Kind, (n: number) => string> = { price: formatPrice, usd: formatUsd, pct: (n) => formatPct(n), int: formatNumber };

interface Props {
  value: number;
  kind: Kind;
  className?: string;
  /** Colorea verde/rojo según el signo (para variaciones %). */
  signed?: boolean;
}

/** Número que "late" en verde/rojo cuando cambia, para que se note que los datos se mueven en vivo. */
export function LiveValue({ value, kind, className, signed = false }: Props) {
  const prev = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    setDir(value > prev.current ? 'up' : 'down');
    prev.current = value;
    const id = setTimeout(() => setDir(null), 900);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <span
      className={cn(
        'rounded px-0.5 transition-colors duration-700',
        dir === 'up' && 'bg-emerald-400/25',
        dir === 'down' && 'bg-rose-400/25',
        signed && (value >= 0 ? 'text-emerald-400' : 'text-rose-400'),
        className,
      )}
    >
      {FMT[kind](value)}
    </span>
  );
}
