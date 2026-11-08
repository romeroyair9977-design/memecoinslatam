import { NextResponse } from 'next/server';
import { runXScan } from '@/lib/services/xscan';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/**
 * Escanea X y guarda las menciones nuevas. Úsala con un cron externo (cron-job.org) cada 15–30 min:
 *   GET https://TU-DOMINIO/api/cron/x-scan     Cabecera:  Authorization: Bearer <CRON_SECRET>
 * Aunque no configures el cron, la página de Tendencias en X dispara la misma actualización sola (máx. 1 vez cada 10 min).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta la variable CRON_SECRET en Netlify' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const r = await runXScan();
  const status = r.ok ? 200 : r.reason === 'upstream' ? 502 : 500;
  return NextResponse.json(r, { status });
}
