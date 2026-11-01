'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** Acciones de moderación sobre un reporte: eliminar el mensaje o descartar el reporte. */
export function ReportActions({ reportId, messageId }: { reportId: string; messageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: 'delete' | 'dismiss') {
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy(true); setError(null);
    if (kind === 'delete') {
      const { error: e1 } = await sb.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId);
      if (e1) { setBusy(false); return setError('No se pudo eliminar el mensaje.'); }
    }
    const { error: e2 } = await sb.from('reports').update({ status: kind === 'delete' ? 'resolved' : 'dismissed' }).eq('id', reportId);
    setBusy(false);
    if (e2) return setError('No se pudo actualizar el reporte.');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button disabled={busy} onClick={() => act('delete')} className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60">Eliminar mensaje</button>
      <button disabled={busy} onClick={() => act('dismiss')} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-60">Descartar</button>
      {error && <span role="alert" className="text-sm text-rose-400">{error}</span>}
    </div>
  );
}
