import { NextResponse } from 'next/server';
import { runResolvePredictions } from '@/lib/services/predictions-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Opcional: la tarea también se dispara sola al visitar el sitio. Con cron externo: Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await runResolvePredictions());
}
