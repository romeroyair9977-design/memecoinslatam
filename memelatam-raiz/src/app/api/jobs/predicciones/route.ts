import { NextResponse } from 'next/server';
import { claimJob, finishJob } from '@/lib/services/jobs';
import { runResolvePredictions } from '@/lib/services/predictions-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const MIN_MINUTES = 60;

export async function POST() {
  const claimed = await claimJob('predicciones', MIN_MINUTES);
  if (!claimed) return NextResponse.json({ ok: claimed !== null, ran: false });
  try {
    const r = await runResolvePredictions();
    await finishJob('predicciones', r.ok ? null : r.reason ?? 'error');
    return NextResponse.json({ ok: r.ok, ran: true });
  } catch {
    await finishJob('predicciones', 'excepcion');
    return NextResponse.json({ ok: false, ran: true });
  }
}
