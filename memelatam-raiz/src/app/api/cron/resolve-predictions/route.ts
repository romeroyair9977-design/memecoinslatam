import { NextResponse } from 'next/server';
import { isTokenAlive } from '@/lib/predictions';
import { getTokenByAddress } from '@/lib/services/dexscreener';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

interface Due { id: string; token_key: string; liquidity_at_open: number }

/**
 * Resuelve las predicciones vencidas. Llámala 1 vez al día (o cada hora) con un cron externo gratuito
 * (p. ej. cron-job.org):  GET https://TU-DOMINIO/api/cron/resolve-predictions   con la cabecera
 *   Authorization: Bearer <CRON_SECRET>
 * Si DexScreener no responde para un token, NO se resuelve (se reintenta en la próxima corrida).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'sin service_role' }, { status: 500 });

  const { data, error } = await admin
    .from('predictions')
    .select('id, token_key, liquidity_at_open')
    .eq('status', 'open')
    .lte('resolves_at', new Date().toISOString())
    .limit(100);
  if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
  const due = (data ?? []) as Due[];

  // Una consulta por token (no por predicción).
  const byToken = new Map<string, Due[]>();
  for (const d of due) byToken.set(d.token_key, [...(byToken.get(d.token_key) ?? []), d]);

  let resolved = 0;
  let skipped = 0;
  for (const [key, list] of byToken) {
    const i = key.indexOf(':');
    const chain = key.slice(0, i);
    const address = key.slice(i + 1);
    let pairs;
    try {
      pairs = (await getTokenByAddress(address, { fresh: true })).filter((p) => p.chainId === chain);
    } catch {
      skipped += list.length; // sin datos confiables → no se resuelve
      continue;
    }
    for (const p of list) {
      const { error: e } = await admin.rpc('resolve_prediction', { p_id: p.id, p_alive: isTokenAlive(pairs, Number(p.liquidity_at_open)) });
      if (e) skipped += 1; else resolved += 1;
    }
  }
  return NextResponse.json({ due: due.length, resolved, skipped });
}
