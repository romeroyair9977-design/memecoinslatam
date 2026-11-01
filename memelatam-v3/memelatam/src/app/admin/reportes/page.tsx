import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReportActions } from '@/components/admin/ReportActions';
import { getMe } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatAge } from '@/lib/utils';

export const metadata: Metadata = { title: 'Reportes', robots: { index: false } };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  reason: string;
  created_at: string;
  message_id: string;
  messages: {
    body: string;
    deleted_at: string | null;
    communities: { name: string } | null;
    profiles: { username: string } | null;
  } | null;
  reporter: { username: string } | null;
}

/**
 * Cola de moderación. RLS decide qué reportes ve cada quien: admins ven todo; moderadores de una comunidad
 * solo los de su comunidad; el resto solo ve los suyos (y aquí se les redirige).
 */
export default async function ReportsPage() {
  const me = await getMe();
  if (!me) redirect('/login?next=/admin/reportes');
  const sb = createServerSupabase();
  if (!sb) redirect('/');

  if (!me.is_admin) {
    const { count } = await sb.from('community_members').select('*', { count: 'exact', head: true }).eq('user_id', me.id).eq('role', 'mod');
    if (!count) redirect('/');
  }

  const { data } = await sb
    .from('reports')
    .select('id, reason, created_at, message_id, messages(body, deleted_at, communities(name), profiles!messages_user_id_fkey(username)), reporter:profiles!reports_reporter_id_fkey(username)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.messages);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Reportes abiertos</h1>
        <p className="text-sm text-muted">{me.is_admin ? 'Vista de administrador: todas las comunidades.' : 'Solo ves los reportes de las comunidades que moderas.'}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No hay reportes pendientes. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border border-line bg-panel p-4">
              <p className="text-xs text-muted">
                {r.messages?.communities?.name} · motivo: <strong className="text-ink">{r.reason}</strong> · reportado por @{r.reporter?.username} · {formatAge(new Date(r.created_at).getTime())}
              </p>
              <p className="text-sm"><span className="text-muted">@{r.messages?.profiles?.username}:</span> {r.messages?.deleted_at ? <em className="text-muted">ya eliminado</em> : r.messages?.body}</p>
              <ReportActions reportId={r.id} messageId={r.message_id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
