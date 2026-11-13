import { NextResponse } from 'next/server';
import { claimJob, finishJob } from '@/lib/services/jobs';
import { runPotencial } from '@/lib/services/potencial-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Mínimo de minutos entre dos corridas, para todos los visitantes juntos. */
const MIN_MINUTES = 10;

/** La dispara el sitio al visitarlo (JobPinger). El candado de Postgres evita corridas repetidas. Sin detalles internos. */
export async function POST() {
  const claimed = await claimJob('potencial', MIN_MINUTES);
  if (!claimed) return NextResponse.json({ ok: claimed !== null, ran: false });
  try {
    const r = await runPotencial();
    await finishJob('potencial', r.ok ? null : r.reason ?? 'error', r.diag ?? undefined);
    return NextResponse.json({ ok: r.ok, ran: true });
  } catch {
    await finishJob('potencial', 'excepcion');
    return NextResponse.json({ ok: false, ran: true });
  }
}
