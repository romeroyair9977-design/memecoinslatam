import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/types/community';

/** Perfil del usuario autenticado (o null). Cacheado por request. */
export const getMe = cache(async (): Promise<Profile | null> => {
  const sb = createServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return (profile as Profile | null) ?? null;
});
