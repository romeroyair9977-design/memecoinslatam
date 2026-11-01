import type { ColumnId, TokenSummary } from '@/types/token';
import { TokenCard } from '@/components/token/TokenCard';
import { tokenKey } from '@/types/community';

interface Props {
  title: string;
  description: string;
  tokens: TokenSummary[];
  column: ColumnId;
  /** claves chain:address que aparecieron en el último refresco */
  freshKeys?: Set<string>;
  emptyText?: string;
  /** token_key (chain:address) → miembros de su comunidad. Si viene, las cards muestran el contador. */
  memberCounts?: Record<string, number>;
}

export function TokenColumn({ title, description, tokens, column, freshKeys, emptyText = 'Sin resultados con estos filtros. Se actualiza solo cada 30 s.', memberCounts }: Props) {
  return (
    <section className="min-w-0">
      <h2 className="font-display text-lg font-semibold">{title} <span className="text-sm font-normal text-muted">({tokens.length})</span></h2>
      <p className="mb-3 text-sm text-muted">{description}</p>
      <div className="space-y-2">
        {tokens.length ? tokens.map((t) => <TokenCard key={`${t.chain}:${t.address}`} t={t} column={column} fresh={freshKeys?.has(`${t.chain}:${t.address}`)} members={memberCounts ? (memberCounts[tokenKey(t.chain, t.address)] ?? 0) : undefined} />) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
