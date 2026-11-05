import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

// Tipo explícito: ReturnType<typeof createBrowserClient> deja los callbacks de Realtime sin tipo (implicit any).
let client: SupabaseClient | null = null;

/** Cliente para componentes de cliente ('use client'). Singleton; null si Supabase no está configurado. */
export function getBrowserSupabase() {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
