import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUsd(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return '—';
  return compactUsd.format(n);
}

/** Precios de memecoins pueden ser 0.00000123: usamos cifras significativas, no decimales fijos. */
export function formatPrice(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}

/** "hace 5 min", "hace 3 h", "hace 12 d" */
export function formatAge(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace segundos';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `hace ${d} d`;
  return `hace ${Math.floor(d / 30)} meses`;
}

export const shortAddress = (a: string, n = 4) => (a.length > n * 2 + 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);
