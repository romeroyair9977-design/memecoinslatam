import type { ChatMessage, ReactionRow } from '@/types/community';

/** Select compartido servidor/cliente. El hint de FK es necesario: messages tiene dos FKs a profiles (autor y borrado_por). */
export const MESSAGE_SELECT = '*, profiles!messages_user_id_fkey(username, avatar_url)';

type RawMessage = Omit<ChatMessage, 'author' | 'reactions'> & {
  profiles?: { username: string; avatar_url: string | null } | null;
};

export function shapeMessages(rows: RawMessage[], reactions: ReactionRow[]): ChatMessage[] {
  const byMsg = new Map<string, { user_id: string; emoji: string }[]>();
  for (const r of reactions) {
    const list = byMsg.get(r.message_id) ?? [];
    list.push({ user_id: r.user_id, emoji: r.emoji });
    byMsg.set(r.message_id, list);
  }
  return rows.map(({ profiles, ...m }) => ({ ...m, author: profiles ?? null, reactions: byMsg.get(m.id) ?? [] }));
}

/** Estas direcciones/URLs aparecen enlazadas en el chat. */
export const isSafeImageUrl = (url: string | null, supabaseUrl: string) =>
  !!url && !!supabaseUrl && url.startsWith(`${supabaseUrl}/storage/v1/object/public/chat-images/`);
