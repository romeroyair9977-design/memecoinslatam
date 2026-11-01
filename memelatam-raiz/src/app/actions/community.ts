'use server';

import { revalidatePath } from 'next/cache';
import { detectAddressKind } from '@/lib/addresses';
import { isSupportedChain } from '@/lib/chains';
import { getTokenFull } from '@/lib/services/token';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { tokenKey, type Stance } from '@/types/community';

export type ActionResult = { ok: true } | { ok: false; error: string; needsLogin?: boolean };

/**
 * Valida el token contra DexScreener (para que nadie invente tokens o metadatos falsos) y lo registra
 * con service_role. Devuelve el token_key.
 */
async function registerToken(chain: string, address: string) {
  if (!isSupportedChain(chain) || !detectAddressKind(address)) return { ok: false, error: 'Token o red no válidos.' } as const;
  const res = await getTokenFull(address, chain);
  if (res.status !== 'ok') return { ok: false, error: 'No pudimos verificar este token. Intenta de nuevo en un momento.' } as const;
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: 'El servidor no tiene configurada SUPABASE_SERVICE_ROLE_KEY.' } as const;
  const t = res.token;
  return { ok: true, admin, t, key: tokenKey(t.chain, t.address) } as const;
}

async function requireUser() {
  const sb = createServerSupabase();
  if (!sb) return { ok: false, error: 'Supabase no está configurado (modo demo).', needsLogin: false } as const;
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: 'Inicia sesión para continuar.', needsLogin: true } as const;
  return { ok: true, sb, user: data.user } as const;
}

/** Crea la comunidad del token si no existe y une al usuario. Los 3 primeros miembros son moderadores. */
export async function joinTokenCommunity(chain: string, address: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error, needsLogin: auth.needsLogin };
  const reg = await registerToken(chain, address);
  if (!reg.ok) return { ok: false, error: reg.error };

  const { error } = await reg.admin.rpc('join_token_community', {
    p_user_id: auth.user.id,
    p_chain: reg.t.chain,
    p_address: reg.t.address,
    p_symbol: reg.t.symbol,
    p_name: reg.t.name,
    p_image: reg.t.imageUrl,
  });
  if (error) return { ok: false, error: 'No se pudo unir a la comunidad.' };
  revalidatePath(`/comunidad/${reg.t.chain}/${reg.t.address}`);
  revalidatePath('/comunidad');
  return { ok: true };
}

export async function leaveCommunity(communityId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.sb.from('community_members').delete().eq('community_id', communityId).eq('user_id', auth.user.id);
  if (error) return { ok: false, error: 'No se pudo salir de la comunidad.' };
  revalidatePath('/comunidad', 'layout');
  return { ok: true };
}

/** Publica una tesis. El token se registra en el servidor; la tesis se inserta con la sesión del usuario (RLS). */
export async function postThesis(chain: string, address: string, stance: Stance, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (text.length < 5 || text.length > 500) return { ok: false, error: 'La tesis debe tener entre 5 y 500 caracteres.' };
  if (!['alcista', 'bajista', 'cuidado'].includes(stance)) return { ok: false, error: 'Postura no válida.' };

  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error, needsLogin: auth.needsLogin };
  const reg = await registerToken(chain, address);
  if (!reg.ok) return { ok: false, error: reg.error };

  const { error: upErr } = await reg.admin.rpc('upsert_token', {
    p_chain: reg.t.chain,
    p_address: reg.t.address,
    p_symbol: reg.t.symbol,
    p_name: reg.t.name,
    p_image: reg.t.imageUrl,
  });
  if (upErr) return { ok: false, error: 'No se pudo registrar el token.' };

  const { error } = await auth.sb.from('theses').insert({ token_key: reg.key, user_id: auth.user.id, stance, body: text });
  if (error) return { ok: false, error: 'No se pudo publicar la tesis.' };
  revalidatePath(`/token/${reg.t.address}`);
  revalidatePath('/actividad');
  return { ok: true };
}
