import { NextResponse, type NextRequest } from 'next/server';
import { resolveDuePredictions } from '@/lib/services/predictions';

export const dynamic = 'force-dynamic';

/**
 * Resuelve predicciones vencidas. Opcional: llámala con un cron gratuito (p. ej. cron-job.org) una vez al día:
 *   GET /api/cron/predicciones   con el header  Authorization: Bearer <CRON_SECRET>
 * Sin CRON_SECRET configurado, el endpoint se desactiva. (Igual se resuelven solas al abrir /predicciones.)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ resolved: await resolveDuePredictions() });
}
