import { NextResponse } from 'next/server';
import { runXScan } from '@/lib/services/xscan';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Mínimo de minutos entre dos escaneos disparados desde la página (protege tu saldo de twitterapi.io). */
const MIN_MINUTES = Math.max(5, Number(process.env.X_REFRESH_MIN ?? 30) || 30);

/**
 * La página de Tendencias en X llama aquí cuando sus datos están viejos. No necesita cron externo.
 * El candado de Postgres (x_scan_claim) garantiza que, vengan las visitas que vengan, se escanea como máximo
 * una vez cada MIN_MINUTES. No devuelve detalles internos: para diagnosticar usa /api/x-trends/status.
 */
export async function POST() {
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, ran: false });

  const { data: claimed, error } = await admin.rpc('x_scan_claim', { p_min_minutes: MIN_MINUTES });
  if (error) return NextResponse.json({ ok: false, ran: false }); // falta ejecutar la migración 0006
  if (!claimed) return NextResponse.json({ ok: true, ran: false });

  const r = await runXScan();
  return NextResponse.json({ ok: r.ok, ran: r.ran });
}
