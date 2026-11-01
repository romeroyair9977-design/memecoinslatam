import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente para componentes de cliente ('use client'). Singleton; null si Supabase no está configurado. */
export function getBrowserSupabase() {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
