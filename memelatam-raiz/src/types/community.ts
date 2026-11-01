/** Tipos de la capa social (espejo del schema de Supabase). */

export type CommunityKind = 'general' | 'token';
export type Role = 'member' | 'mod';

export const GENERAL_CHANNELS = [
  { id: 'general', label: 'General', hint: 'Todo sobre memecoins' },
  { id: 'senales', label: 'Señales', hint: 'Tokens que están sonando' },
  { id: 'rugs', label: 'Rugs', hint: 'Alertas y scams' },
  { id: 'nuevas', label: 'Nuevas', hint: 'Lanzamientos recientes' },
] as const;

export const TOKEN_CHANNELS = [
  { id: 'chat', label: 'Chat', hint: 'Conversación en tiempo real' },
  { id: 'posts', label: 'Posts', hint: 'Tesis y análisis más largos' },
] as const;

export const REACTION_EMOJIS = ['🚀', '🔥', '💀', '🐸', '👀', '💎'] as const;
export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'scam', label: 'Posible scam / shill engañoso' },
  { id: 'acoso', label: 'Acoso' },
  { id: 'otro', label: 'Otro' },
] as const;

export interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  wallet_chain: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface TokenMeta {
  token_key: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
}

export interface Community {
  id: string;
  kind: CommunityKind;
  token_key: string | null;
  name: string;
  description: string | null;
  member_count: number;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  tokens?: TokenMeta | null;
}

export interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ChatMessage {
  id: string;
  community_id: string;
  channel: string;
  user_id: string;
  body: string;
  image_url: string | null;
  reply_to: string | null;
  deleted_at: string | null;
  created_at: string;
  author: { username: string; avatar_url: string | null } | null;
  reactions: { user_id: string; emoji: string }[];
}

export type Stance = 'alcista' | 'bajista' | 'cuidado';

export interface Thesis {
  id: string;
  token_key: string;
  user_id: string;
  stance: Stance;
  body: string;
  created_at: string;
  author: { username: string; avatar_url: string | null } | null;
  token?: Pick<TokenMeta, 'symbol' | 'chain' | 'address'> | null;
}

export interface ActivityEvent {
  id: string;
  type: 'thesis' | 'community_created' | 'member_joined';
  actor_id: string | null;
  token_key: string | null;
  payload: { username?: string; symbol?: string; stance?: Stance; chain?: string; address?: string };
  created_at: string;
}

export const tokenKey = (chain: string, address: string) =>
  `${chain}:${address.startsWith('0x') ? address.toLowerCase() : address}`;
