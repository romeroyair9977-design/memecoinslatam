'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Flag, ImagePlus, Reply, Send, SmilePlus, Trash2, X } from 'lucide-react';
import { MESSAGE_SELECT, isSafeImageUrl, shapeMessages } from '@/lib/community-shared';
import { SUPABASE_URL } from '@/lib/supabase/env';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { renderBody } from '@/lib/text';
import { cn, formatAge } from '@/lib/utils';
import { REACTION_EMOJIS, REPORT_REASONS, type ChatMessage, type ReactionRow } from '@/types/community';

/** Forma mínima del payload de Realtime (compatible con cualquier versión de supabase-js). */
type RealtimeChange = { new?: unknown; old?: unknown };

export interface RoomUser { id: string; username: string; isAdmin: boolean }

interface Props {
  communityId: string;
  channel: string;
  initial: ChatMessage[];
  me: RoomUser | null;
  /** Puede escribir (autenticado y, en comunidades de token, miembro). */
  canWrite: boolean;
  /** Mod de esta comunidad o admin: puede borrar mensajes de otros. */
  isMod: boolean;
  /** Se muestra en lugar del composer cuando no puede escribir (botón de login / unirse). */
  lockedNotice?: ReactNode;
  placeholder?: string;
  /** Modo demo: sin Supabase, solo lectura. */
  demo?: boolean;
}

const MAX_IMAGE = 3 * 1024 * 1024;
const PAGE = 50;

export function ChatRoom({ communityId, channel, initial, me, canWrite, isMod, lockedNotice, placeholder, demo }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const authors = useRef(new Map<string, ChatMessage['author']>());

  // Autores conocidos (para pintar mensajes que llegan por realtime sin consulta extra)
  useEffect(() => {
    for (const m of initial) authors.current.set(m.user_id, m.author);
  }, [initial]);

  // Reiniciar al cambiar de canal / comunidad
  useEffect(() => { setMessages(initial); setHasMore(initial.length >= PAGE); stick.current = true; }, [initial, channel, communityId]);

  // Auto-scroll si el usuario está cerca del final
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const getAuthor = useCallback(async (userId: string) => {
    const cached = authors.current.get(userId);
    if (cached) return cached;
    const sb = getBrowserSupabase();
    const { data } = (await sb?.from('profiles').select('username, avatar_url').eq('id', userId).maybeSingle()) ?? { data: null };
    const a = (data as ChatMessage['author']) ?? null;
    authors.current.set(userId, a);
    return a;
  }, []);

  // ── Realtime ──
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || demo) return;
    const filter = `community_id=eq.${communityId}`;
    const ch = sb
      .channel(`room:${communityId}:${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, async (p: RealtimeChange) => {
        const row = p.new as Omit<ChatMessage, 'author' | 'reactions'>;
        if (row.channel !== channel) return;
        const author = await getAuthor(row.user_id);
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, author, reactions: [] }]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (p: RealtimeChange) => {
        const row = p.new as { id: string; deleted_at: string | null };
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, deleted_at: row.deleted_at } : m)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter }, (p: RealtimeChange) => {
        const r = p.new as ReactionRow;
        setMessages((prev) =>
          prev.map((m) =>
            m.id !== r.message_id || m.reactions.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)
              ? m
              : { ...m, reactions: [...m.reactions, { user_id: r.user_id, emoji: r.emoji }] },
          ),
        );
      })
      // Los DELETE no admiten filtro en Realtime; con REPLICA IDENTITY FULL llegan completos y filtramos aquí.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (p: RealtimeChange) => {
        const r = p.old as Partial<ReactionRow>;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === r.message_id ? { ...m, reactions: m.reactions.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)) } : m,
          ),
        );
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [communityId, channel, demo, getAuthor]);

  async function loadOlder() {
    const sb = getBrowserSupabase();
    if (!sb || !messages.length) return;
    const { data: rows } = await sb
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('community_id', communityId)
      .eq('channel', channel)
      .lt('created_at', messages[0].created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (!rows?.length) { setHasMore(false); return; }
    const { data: reactions } = await sb.from('reactions').select('message_id, user_id, emoji').in('message_id', rows.map((r: { id: string }) => r.id));
    const older = shapeMessages(rows as never[], (reactions ?? []) as ReactionRow[]).reverse();
    for (const m of older) authors.current.set(m.user_id, m.author);
    stick.current = false;
    setMessages((prev) => [...older, ...prev]);
    setHasMore(rows.length >= PAGE);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    const text = body.trim();
    if (!sb || !me || (!text && !file) || sending) return;
    setSending(true);
    setError(null);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('chat-images').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error('No se pudo subir la imagen.');
        image_url = sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
      }
      const { data, error: err } = await sb
        .from('messages')
        .insert({ community_id: communityId, channel, user_id: me.id, body: text || '📷', image_url, reply_to: replyTo?.id ?? null })
        .select('*')
        .single();
      if (err) throw new Error(err.message.includes('muy rápido') ? err.message : 'No se pudo enviar el mensaje.');
      authors.current.set(me.id, { username: me.username, avatar_url: null });
      stick.current = true;
      setMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, { ...(data as ChatMessage), author: { username: me.username, avatar_url: null }, reactions: [] }],
      );
      setBody('');
      setFile(null);
      setReplyTo(null);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al enviar.');
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(m: ChatMessage, emoji: string) {
    const sb = getBrowserSupabase();
    if (!sb || !me) return;
    setPicker(null);
    const mine = m.reactions.some((r) => r.user_id === me.id && r.emoji === emoji);
    // Optimista; realtime lo confirma (los duplicados se ignoran)
    setMessages((prev) =>
      prev.map((x) =>
        x.id !== m.id ? x : { ...x, reactions: mine ? x.reactions.filter((r) => !(r.user_id === me.id && r.emoji === emoji)) : [...x.reactions, { user_id: me.id, emoji }] },
      ),
    );
    const { error: err } = mine
      ? await sb.from('reactions').delete().eq('message_id', m.id).eq('user_id', me.id).eq('emoji', emoji)
      : await sb.from('reactions').insert({ message_id: m.id, user_id: me.id, emoji });
    if (err) setNotice('No se pudo registrar tu reacción.');
  }

  async function remove(m: ChatMessage) {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { error: err } = await sb.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id);
    if (err) setNotice('No se pudo eliminar el mensaje.');
    else setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
  }

  async function report(m: ChatMessage, reason: string) {
    const sb = getBrowserSupabase();
    if (!sb || !me) return;
    setReporting(null);
    const { error: err } = await sb.from('reports').insert({ message_id: m.id, reporter_id: me.id, reason });
    setNotice(err?.code === '23505' ? 'Ya reportaste este mensaje.' : err ? 'No se pudo enviar el reporte.' : 'Gracias, lo revisará un moderador.');
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return setError('Solo imágenes PNG, JPG, WEBP o GIF.');
    if (f.size > MAX_IMAGE) return setError('La imagen pesa más de 3 MB.');
    setError(null);
    setFile(f);
  }

  const byId = new Map(messages.map((m) => [m.id, m]));

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-xl border border-line bg-panel/60">
      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-1 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="Mensajes">
        {hasMore && !demo && (
          <button onClick={loadOlder} className="mx-auto mb-2 block rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink">
            Cargar anteriores
          </button>
        )}
        {messages.length === 0 && (
          <p className="grid h-full place-items-center text-center text-sm text-muted">Aún no hay mensajes en este canal. ¡Rompe el hielo!</p>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.user_id;
          const parent = m.reply_to ? byId.get(m.reply_to) : null;
          const grouped = new Map<string, number>();
          m.reactions.forEach((r) => grouped.set(r.emoji, (grouped.get(r.emoji) ?? 0) + 1));
          const deleted = !!m.deleted_at;
          return (
            <article key={m.id} className="group relative flex gap-3 rounded-lg px-2 py-1.5 hover:bg-panel2/50">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel2 text-xs font-semibold uppercase text-muted" aria-hidden>
                {(m.author?.username ?? '?').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs text-muted">
                  {m.author ? <Link href={`/perfil/${m.author.username}`} className={cn('text-sm font-medium hover:underline', mine ? 'text-brand' : 'text-ink')}>{m.author.username}</Link> : <span>anónimo</span>}
                  <time dateTime={m.created_at}>{formatAge(new Date(m.created_at).getTime())}</time>
                </p>
                {parent && !deleted && (
                  <p className="mt-0.5 truncate border-l-2 border-line pl-2 text-xs text-muted">
                    ↪ {parent.author?.username ?? '…'}: {parent.deleted_at ? 'mensaje eliminado' : parent.body}
                  </p>
                )}
                {deleted ? (
                  <p className="text-sm italic text-muted">Mensaje eliminado</p>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderBody(m.body)}</p>
                    {isSafeImageUrl(m.image_url, SUPABASE_URL) && (
                      <a href={m.image_url!} target="_blank" rel="noopener noreferrer">
                        <img src={m.image_url!} alt="Imagen adjunta" loading="lazy" className="mt-1 max-h-64 rounded-lg border border-line" />
                      </a>
                    )}
                  </>
                )}
                {!deleted && (grouped.size > 0 || (me && !demo)) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {[...grouped].map(([emoji, n]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(m, emoji)}
                        disabled={!me || demo}
                        aria-label={`Reaccionar con ${emoji}`}
                        className={cn('rounded-full border px-2 py-0.5 text-xs', m.reactions.some((r) => r.user_id === me?.id && r.emoji === emoji) ? 'border-brand/60 bg-brand/10' : 'border-line')}
                      >
                        {emoji} {n}
                      </button>
                    ))}
                    {me && !demo && (
                      <span className="relative flex items-center gap-1 text-muted opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button onClick={() => setPicker(picker === m.id ? null : m.id)} aria-label="Añadir reacción" className="rounded p-1 hover:text-ink"><SmilePlus className="h-4 w-4" /></button>
                        <button onClick={() => { setReplyTo(m); }} aria-label="Responder" className="rounded p-1 hover:text-ink"><Reply className="h-4 w-4" /></button>
                        {!mine && <button onClick={() => setReporting(reporting === m.id ? null : m.id)} aria-label="Reportar" className="rounded p-1 hover:text-rose-400"><Flag className="h-4 w-4" /></button>}
                        {(mine || isMod) && <button onClick={() => remove(m)} aria-label="Eliminar mensaje" className="rounded p-1 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>}
                        {picker === m.id && (
                          <span className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-line bg-panel p-1 shadow-lg">
                            {REACTION_EMOJIS.map((e) => (
                              <button key={e} onClick={() => toggleReaction(m, e)} className="rounded p-1 text-base hover:bg-panel2">{e}</button>
                            ))}
                          </span>
                        )}
                        {reporting === m.id && (
                          <span className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-lg border border-line bg-panel p-1 text-xs shadow-lg">
                            <span className="block px-2 py-1 text-muted">Motivo del reporte</span>
                            {REPORT_REASONS.map((r) => (
                              <button key={r.id} onClick={() => report(m, r.id)} className="block w-full rounded px-2 py-1 text-left text-ink hover:bg-panel2">{r.label}</button>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {notice && (
        <p role="status" className="flex items-center justify-between border-t border-line bg-panel2 px-3 py-1.5 text-xs">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso"><X className="h-3.5 w-3.5" /></button>
        </p>
      )}

      {canWrite && me && !demo ? (
        <form onSubmit={send} className="border-t border-line p-2">
          {replyTo && (
            <p className="mb-1 flex items-center justify-between rounded bg-panel2 px-2 py-1 text-xs text-muted">
              <span className="truncate">Respondiendo a {replyTo.author?.username}: {replyTo.body}</span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar respuesta"><X className="h-3.5 w-3.5" /></button>
            </p>
          )}
          {file && (
            <p className="mb-1 flex items-center justify-between rounded bg-panel2 px-2 py-1 text-xs text-muted">
              <span className="truncate">📎 {file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Quitar imagen"><X className="h-3.5 w-3.5" /></button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-muted hover:text-ink" title="Adjuntar imagen">
              <ImagePlus className="h-4 w-4" aria-hidden />
              <span className="sr-only">Adjuntar imagen</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              rows={1}
              maxLength={1000}
              placeholder={placeholder ?? 'Escribe un mensaje… pega un contrato o un link'}
              aria-label="Mensaje"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line bg-panel p-2.5 text-sm placeholder:text-muted"
            />
            <button type="submit" disabled={sending || (!body.trim() && !file)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-bg hover:bg-brand-dim disabled:opacity-50" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </div>
          {error && <p role="alert" className="mt-1 text-xs text-rose-400">{error}</p>}
        </form>
      ) : (
        <div className="border-t border-line p-3 text-center text-sm text-muted">
          {demo ? 'Modo demo: conecta Supabase para escribir.' : lockedNotice ?? 'Inicia sesión para escribir.'}
        </div>
      )}
    </div>
  );
}
