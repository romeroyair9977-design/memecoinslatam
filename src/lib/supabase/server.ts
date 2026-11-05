import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

/** Cliente con la sesión del usuario (cookies). Usar en Server Components / Server Actions / Route Handlers. */
export function createServerSupabase() {
  if (!isSupabaseConfigured) return null;
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el middleware refresca la sesión.
        }
      },
    },
  });
}

/**
 * Cliente anónimo SIN cookies: no vuelve dinámica la página, así que la home puede seguir con ISR (`revalidate`).
 * Solo para lecturas públicas.
 */
export function createPublicSupabase() {
  if (!isSupabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cliente con service_role: se salta RLS. SOLO servidor, y solo para operaciones ya validadas. */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
