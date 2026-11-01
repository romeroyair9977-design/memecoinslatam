import type { TokenSummary } from '@/types/token';
import { TokenCard } from '@/components/token/TokenCard';

interface Props {
  title: string;
  description: string;
  tokens: TokenSummary[];
  emptyText?: string;
}

export function TokenColumn({ title, description, tokens, emptyText = 'Sin resultados por ahora. Se actualiza cada minuto.' }: Props) {
  return (
    <section className="min-w-0">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-muted">{description}</p>
      <div className="space-y-2">
        {tokens.length ? tokens.map((t) => <TokenCard key={`${t.chain}:${t.address}`} t={t} />) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
