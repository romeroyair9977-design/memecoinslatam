import type { ActivityStatus, RiskLevel } from '@/types/token';
import { cn } from '@/lib/utils';

const RISK: Record<RiskLevel, { label: string; cls: string }> = {
  low: { label: 'Riesgo bajo', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  medium: { label: 'Riesgo medio', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  high: { label: 'Riesgo alto', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  critical: { label: 'Riesgo crítico', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export function RiskBadge({ level, score, className }: { level: RiskLevel; score?: number; className?: string }) {
  const r = RISK[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', r.cls, className)}>
      {r.label}
      {score !== undefined && <span className="opacity-70">{score}/100</span>}
    </span>
  );
}

const ACTIVITY: Record<ActivityStatus, { label: string; cls: string }> = {
  fantasma: { label: 'Fantasma', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  tibio: { label: 'Poca actividad', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  activo: { label: 'Con vida', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
};

export function ActivityBadge({ status, className }: { status: ActivityStatus; className?: string }) {
  const a = ACTIVITY[status];
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', a.cls, className)}>
      {a.label}
    </span>
  );
}
