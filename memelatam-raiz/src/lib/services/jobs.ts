import 'server-only';
import { createAdminSupabase } from '../supabase/server';

/**
 * Candado de tareas periódicas. Devuelve true si le toca correr a ESTA llamada, false si otra corrió hace poco,
 * y null si no se puede saber (falta service_role o la migración 0007).
 */
export async function claimJob(key: string, minMinutes: number): Promise<boolean | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.rpc('job_claim', { p_key: key, p_min_minutes: minMinutes });
  if (error) return null;
  return Boolean(data);
}

export async function finishJob(key: string, error: string | null, details?: unknown): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin.from('app_jobs').update({ last_finished: new Date().toISOString(), last_error: error }).eq('key', key);
  // `details` llega con la migración 0008: si aún no existe, este segundo paso falla en silencio y lo demás sigue igual.
  if (details !== undefined) await admin.from('app_jobs').update({ details }).eq('key', key);
}
