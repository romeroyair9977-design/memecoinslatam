import 'server-only';
import { MESSAGE_SHAPE_LIMIT } from '@/lib/config';
import { MESSAGE_SELECT, shapeMessages } from '@/lib/community-shared';
import { createPublicSupabase, createServerSupabase } from '@/lib/supabase/server';
import type { ActivityEvent, ChatMessage, Community, Profile, ReactionRow, Role, Thesis } from '@/types/community';

/**
 * Capa de lectura de la parte social. Todas las funciones devuelven valores vacíos si Supabase no está
 * configurado o si falla la consulta: la UI decide si muestra datos demo o un estado vacío.
 */

const COMMUNITY_SELECT = '*, tokens(token_key, chain, address, symbol, name, image_url)';

export async function getGeneralCommunity(): Promise<Community | null> {
  const sb = createPublicSupabase();
  if (!sb) return null;
  const { data } = await sb.from('communities').select('*').eq('kind', 'general').maybeSingle();
  return (data as Community | null) ?? null;
}

export async function getTokenCommunity(key: string): Promise<Community | null> {
  const sb = createPublicSupabase();
  if (!sb) return null;
  const { data } = await sb.from('communities').select(COMMUNITY_SELECT).eq('token_key', key).maybeSingle();
  return (data as Community | null) ?? null;
}

/** Últimos N mensajes de un canal, en orden cronológico (más viejo primero). */
export async function getMessages(communityId: string, channel: string, limit = MESSAGE_SHAPE_LIMIT): Promise<ChatMessage[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data: rows } = await sb
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('community_id', communityId)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!rows?.length) return [];
  const ids = rows.map((r: { id: string }) => r.id);
  const { data: reactions } = await sb.from('reactions').select('message_id, user_id, emoji').in('message_id', ids);
  return shapeMessages(rows as never[], (reactions ?? []) as ReactionRow[]).reverse();
}

/** token_key → nº de miembros. Para mostrar el contador en las cards del dashboard. */
export async function getMemberCounts(keys: string[]): Promise<Record<string, number>> {
  const sb = createPublicSupabase();
  if (!sb || !keys.length) return {};
  const { data } = await sb.from('communities').select('token_key, member_count').in('token_key', keys);
  return Object.fromEntries((data ?? []).map((c: { token_key: string; member_count: number }) => [c.token_key, c.member_count]));
}

export async function getTopCommunities(limit = 8): Promise<Community[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('communities')
    .select(COMMUNITY_SELECT)
    .eq('kind', 'token')
    .order('member_count', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as Community[];
}

/** Rol del usuario en una comunidad (null = no es miembro). */
export async function getRole(communityId: string, userId: string): Promise<Role | null> {
  const sb = createServerSupabase();
  if (!sb) return null;
  const { data } = await sb.from('community_members').select('role').eq('community_id', communityId).eq('user_id', userId).maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

export async function getModerators(communityId: string): Promise<Pick<Profile, 'username'>[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('community_members')
    .select('profiles(username)')
    .eq('community_id', communityId)
    .eq('role', 'mod')
    .limit(5);
  return (data ?? []).flatMap((r: { profiles: { username: string } | { username: string }[] | null }) =>
    Array.isArray(r.profiles) ? r.profiles : r.profiles ? [r.profiles] : [],
  );
}

export async function getTheses(key: string, limit = 30): Promise<Thesis[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('theses')
    .select('*, profiles!theses_user_id_fkey(username, avatar_url)')
    .eq('token_key', key)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(({ profiles, ...t }: { profiles: Thesis['author'] } & Record<string, unknown>) => ({ ...t, author: profiles })) as unknown as Thesis[];
}

export async function getActivity(limit = 30, onlyActors?: string[]): Promise<ActivityEvent[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  let q = sb.from('activity_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (onlyActors) {
    if (!onlyActors.length) return [];
    q = q.in('actor_id', onlyActors);
  }
  const { data } = await q;
  return (data ?? []) as ActivityEvent[];
}

/** IDs de usuarios que sigue `userId`. */
export async function getFollowingIds(userId: string): Promise<string[]> {
  const sb = createServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('follows').select('followed_id').eq('follower_id', userId);
  return (data ?? []).map((r: { followed_id: string }) => r.followed_id);
}

/** Direcciones de wallets (en esta chain) que sigue el usuario actual. */
export async function getFollowedWallets(userId: string, chain: string): Promise<string[]> {
  const sb = createServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('wallet_follows').select('address').eq('user_id', userId).eq('chain', chain);
  return (data ?? []).map((r: { address: string }) => r.address);
}

export async function getProfileByUsername(username: string) {
  const sb = createPublicSupabase();
  if (!sb) return null;
  const { data: profile } = await sb.from('profiles').select('*').ilike('username', username).maybeSingle();
  if (!profile) return null;
  const [followers, following, theses] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', profile.id),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    sb
      .from('theses')
      .select('id, stance, body, created_at, token_key, tokens(symbol, chain, address)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  return {
    profile: profile as Profile,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    theses: (theses.data ?? []) as unknown as {
      id: string; stance: Thesis['stance']; body: string; created_at: string; token_key: string;
      tokens: { symbol: string; chain: string; address: string } | null;
    }[],
  };
}
