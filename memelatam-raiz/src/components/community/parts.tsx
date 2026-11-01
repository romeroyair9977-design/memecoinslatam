import Link from 'next/link';
import { Users } from 'lucide-react';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { cn, formatAge } from '@/lib/utils';
import type { Community } from '@/types/community';

export function DemoBanner() {
  return (
    <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      <strong>Modo demo.</strong> Estás viendo datos de ejemplo. Conecta Supabase (ver README) para chatear, reaccionar y crear comunidades de verdad.
    </p>
  );
}

export function ChannelTabs({ base, channels, active }: { base: string; channels: readonly { id: string; label: string; hint: string }[]; active: string }) {
  return (
    <nav aria-label="Canales" className="flex gap-1 overflow-x-auto pb-1">
      {channels.map((c) => (
        <Link
          key={c.id}
          href={c.id === channels[0].id ? base : `${base}?canal=${c.id}`}
          title={c.hint}
          aria-current={active === c.id ? 'page' : undefined}
          className={cn('shrink-0 rounded-full border px-3 py-1 text-sm', active === c.id ? 'border-brand/60 bg-panel2 text-ink' : 'border-line text-muted hover:text-ink')}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

export function CommunityList({ communities, title = 'Comunidades de tokens' }: { communities: Community[]; title?: string }) {
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-panel/50 p-4">
      <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>
      {communities.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay comunidades. Abre un token y crea la primera.</p>
      ) : (
        <ul className="space-y-2">
          {communities.map((c) => {
            const t = c.tokens;
            return (
              <li key={c.id}>
                <Link href={t ? `/comunidad/${t.chain}/${t.address}` : '/comunidad'} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-panel2">
                  <TokenAvatar src={t?.image_url ?? null} symbol={t?.symbol ?? c.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t?.symbol ?? c.name}</span>
                    <span className="block text-xs text-muted">{t ? chainLabel(t.chain) : ''}{c.last_message_at ? ` · activo ${formatAge(new Date(c.last_message_at).getTime())}` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted"><Users className="h-3.5 w-3.5" aria-hidden />{c.member_count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
