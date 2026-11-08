import { NextResponse } from 'next/server';
import { createPublicSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico de Tendencias en X en una sola URL: /api/x-trends/status
 * Solo muestra SI cada pieza está configurada (sí/no), nunca valores secretos.
 */
export async function GET() {
  const configured = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    twitterKey: Boolean(process.env.TWITTERAPI_IO_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };
  const sb = createPublicSupabase();
  let lastScanAt: string | null = null;
  let lastError: string | null = null;
  let spentTodayUsd: number | null = null;
  let mentions24h: number | null = null;
  let migration0006 = false;

  if (sb) {
    const { data } = await sb.from('x_scan_state').select('*').eq('id', 1).maybeSingle();
    if (data) {
      lastScanAt = Number(data.last_until) > 0 ? (data.updated_at as string) : null;
      migration0006 = 'last_started' in data;
      lastError = (data.last_error as string | null) ?? null;
      spentTodayUsd = data.spent_day === new Date().toISOString().slice(0, 10) ? Number(data.spent_usd ?? 0) : 0;
    }
    const { count } = await sb.from('x_mentions').select('id', { count: 'exact', head: true }).gte('tweeted_at', new Date(Date.now() - 86_400_000).toISOString());
    mentions24h = count ?? null;
  }

  const hints: string[] = [];
  if (!configured.twitterKey) hints.push('Falta TWITTERAPI_IO_KEY en Netlify (y redesplegar).');
  if (!configured.serviceRole) hints.push('Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.');
  if (!configured.cronSecret) hints.push('Falta CRON_SECRET (solo necesaria si usas cron externo).');
  if (sb && !migration0006) hints.push('Falta ejecutar la migración 0006 en Supabase.');
  if (lastError) hints.push(`Último error al escanear: ${lastError}. HTTP 401/403 = key inválida; 402 = sin saldo; 429 = demasiadas consultas.`);
  if (!lastScanAt && configured.twitterKey && configured.serviceRole && !lastError) hints.push('Todavía no corrió ningún escaneo: abre /tendencias-x una vez o llama al cron.');

  return NextResponse.json({ configured, lastScanAt, lastError, spentTodayUsd, mentions24h, migration0006, hints }, { headers: { 'Cache-Control': 'no-store' } });
}
