import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico de la última corrida de Potencial: cuántas monedas pasaron cada filtro y por qué se rechazó cada candidata.
 * Solo contiene datos públicos de mercado (nada secreto). Para usarlo hace falta la migración 0008.
 */
export async function GET() {
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, reason: 'missing_service_role' });
  const { data } = await admin.from('app_jobs').select('*').eq('key', 'potencial').maybeSingle();
  if (!data) return NextResponse.json({ ok: true, ran: false });
  return NextResponse.json(
    { ok: true, ran: true, lastStarted: data.last_started ?? null, lastFinished: data.last_finished ?? null, lastError: data.last_error ?? null, details: data.details ?? null, hasDetailsColumn: 'details' in data },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
