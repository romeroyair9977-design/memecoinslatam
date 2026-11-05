import type { ActivityEvent, ChatMessage, Community, Thesis } from '@/types/community';

/**
 * Datos de demostración para cuando Supabase NO está configurado (o la base está vacía en desarrollo).
 * Los timestamps son relativos a "ahora" para que la UI siempre se vea viva.
 */
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const msg = (id: string, channel: string, user: string, body: string, min: number, reactions: [string, number][] = []): ChatMessage => ({
  id,
  community_id: 'demo-general',
  channel,
  user_id: `demo-${user}`,
  body,
  image_url: null,
  reply_to: null,
  deleted_at: null,
  created_at: ago(min),
  author: { username: user, avatar_url: null },
  reactions: reactions.flatMap(([emoji, n]) => Array.from({ length: n }, (_, i) => ({ user_id: `demo-r${emoji}${i}`, emoji }))),
});

export const MOCK_GENERAL: Community = {
  id: 'demo-general',
  kind: 'general',
  token_key: null,
  name: 'Comunidad General',
  description: 'Todo sobre memecoins en español: tesis, señales, rugs y nuevas.',
  member_count: 1284,
  message_count: 9421,
  last_message_at: ago(1),
  created_at: ago(60 * 24 * 40),
};

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  general: [
    msg('m1', 'general', 'cripto_chilango', 'Buenas gente, ¿alguien revisó el top 10 de holders antes de entrar a lo de ayer? A mí me dio 62% y salí.', 42, [['👀', 3]]),
    msg('m2', 'general', 'la_ballena_mx', 'Eso es lo primero que miro siempre. Si el top 10 pasa de 50% ni lo toco, aunque suba.', 39, [['💎', 5]]),
    msg('m3', 'general', 'sol_paisa', 'Parceros, ojo con los tokens sin redes: dos de cada tres son fantasmas. Mejor esperen a ver volumen real.', 31, [['🔥', 4]]),
    msg('m4', 'general', 'rana_porteña', 'Vengo siguiendo una wallet que compró temprano en tres tokens que migraron. Les paso el dato cuando confirme.', 18),
    msg('m5', 'general', 'cripto_chilango', 'Si la comparten, pónganla en su perfil para que todos la sigamos 🙏', 15, [['🚀', 2]]),
    msg('m6', 'general', 'dev_en_pijama', 'Recuerden: liquidez bloqueada y mint renunciado no te salvan de un dev que vende. Sigan el flujo de wallets.', 6, [['💀', 1], ['💎', 6]]),
  ],
  senales: [
    msg('s1', 'senales', 'sol_paisa', 'Señal: volumen de 5 min x6 en un token de 3 h de vida. Liquidez 48k. Voy a esperar confirmación, no FOMO.', 22, [['👀', 7]]),
    msg('s2', 'senales', 'la_ballena_mx', 'Confirmo, 12 compradores nuevos en 10 min y el top 10 está en 28%. Se ve sano por ahora.', 14, [['🔥', 3]]),
  ],
  rugs: [
    msg('r1', 'rugs', 'dev_en_pijama', '⚠️ Cuidado con el token que están shilleando en X: mint activo y 71% en 5 wallets. Rug probable.', 55, [['💀', 9]]),
  ],
  nuevas: [
    msg('n1', 'nuevas', 'rana_porteña', 'Lanzamiento hace 20 min con 15k de liquidez. Todavía sin redes. Observando.', 20, [['👀', 2]]),
  ],
};

export const MOCK_TOP_COMMUNITIES: Community[] = [
  { id: 'dc1', kind: 'token', token_key: 'solana:demo1', name: 'BONKITO', description: null, member_count: 412, message_count: 1800, last_message_at: ago(2), created_at: ago(9000),
    tokens: { token_key: 'solana:demo1', chain: 'solana', address: 'demo1', symbol: 'BONKITO', name: 'Bonkito', image_url: null } },
  { id: 'dc2', kind: 'token', token_key: 'base:demo2', name: 'CHAMBA', description: null, member_count: 238, message_count: 960, last_message_at: ago(7), created_at: ago(7000),
    tokens: { token_key: 'base:demo2', chain: 'base', address: 'demo2', symbol: 'CHAMBA', name: 'Chamba Coin', image_url: null } },
  { id: 'dc3', kind: 'token', token_key: 'solana:demo3', name: 'AREPA', description: null, member_count: 97, message_count: 310, last_message_at: ago(15), created_at: ago(3000),
    tokens: { token_key: 'solana:demo3', chain: 'solana', address: 'demo3', symbol: 'AREPA', name: 'Arepa Inu', image_url: null } },
];

export const MOCK_THESES: Thesis[] = [
  { id: 't1', token_key: 'demo', user_id: 'u1', stance: 'alcista', body: 'Comunidad activa y liquidez creciendo tres días seguidos. Top 10 en 31%, razonable para su edad.', created_at: ago(95), author: { username: 'la_ballena_mx', avatar_url: null } },
  { id: 't2', token_key: 'demo', user_id: 'u2', stance: 'cuidado', body: 'El dev mantiene 9% en una sola wallet. Si la mueve al exchange, se acabó. Entrar con poco.', created_at: ago(240), author: { username: 'dev_en_pijama', avatar_url: null } },
];

export const MOCK_ACTIVITY: ActivityEvent[] = [
  { id: 'a1', type: 'thesis', actor_id: 'u1', token_key: 'solana:demo1', payload: { username: 'la_ballena_mx', symbol: 'BONKITO', stance: 'alcista', chain: 'solana', address: 'demo1' }, created_at: ago(4) },
  { id: 'a2', type: 'community_created', actor_id: 'u3', token_key: 'base:demo2', payload: { username: 'sol_paisa', symbol: 'CHAMBA', chain: 'base', address: 'demo2' }, created_at: ago(26) },
  { id: 'a3', type: 'thesis', actor_id: 'u2', token_key: 'solana:demo3', payload: { username: 'dev_en_pijama', symbol: 'AREPA', stance: 'cuidado', chain: 'solana', address: 'demo3' }, created_at: ago(51) },
];
