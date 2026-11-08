import 'server-only';
import { createAdminSupabase } from '../supabase/server';
import { X_QUERIES, extractMentions, isXUser } from '../xmentions';
import { searchTweets, XApiError, type RawTweet } from './xapi';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const WINDOW_MIN = clamp(Number(process.env.X_WINDOW_MIN ?? 15), 5, 60);
const MAX_WINDOWS = clamp(Number(process.env.X_MAX_WINDOWS ?? 3), 1, 8);
const DAILY_BUDGET_USD = Number(process.env.X_DAILY_BUDGET_USD ?? 0.5);
const TIME_BUDGET_MS = 8_000; // las funciones de Netlify cortan a los ~10 s
const CONCURRENCY = 3;
const MAX_LOOKBACK_S = 2 * 3600;
const COST_PER_UNIT_USD = 0.00015; // por tweet devuelto; mínimo una unidad por llamada

export interface ScanResult {
  ok: boolean;
  ran: boolean;
  /** missing_twitter_key | missing_service_role | daily_budget | too_soon | upstream | storage */
  reason?: string;
  calls: number;
  failed: number;
  tweets: number;
  mentions: number;
  estimatedCostUsd: number;
  /** Primer error de twitterapi.io (código HTTP), para diagnosticar */
  firstError?: string;
  partial: boolean;
}

const empty = (extra: Partial<ScanResult>): ScanResult => ({ ok: false, ran: false, calls: 0, failed: 0, tweets: 0, mentions: 0, estimatedCostUsd: 0, partial: false, ...extra });

interface MentionRow {
  tweet_id: string; term: string; kind: 'cashtag' | 'address'; author: string; lang: string | null; body: string;
  likes: number; retweets: number; replies: number; views: number; tweeted_at: string;
}

/**
 * Escanea X y guarda las menciones nuevas. La usan el cron (/api/cron/x-scan) y la actualización automática que dispara
 * la página (/api/x-trends/refresh). Cada corrida pide solo lo que pasó desde la anterior, partido en ventanas cortas
 * (la paginación de búsqueda de twitterapi.io está rota: cada ventana devuelve su propia página 1).
 */
export async function runXScan(): Promise<ScanResult> {
  if (!process.env.TWITTERAPI_IO_KEY) return empty({ reason: 'missing_twitter_key' });
  const admin = createAdminSupabase();
  if (!admin) return empty({ reason: 'missing_service_role' });

  const { data: state } = await admin.from('x_scan_state').select('*').eq('id', 1).maybeSingle();
  const nowS = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().slice(0, 10);
  const last = Number(state?.last_until ?? 0);
  const spentToday = state?.spent_day === today ? Number(state?.spent_usd ?? 0) : 0;

  if (spentToday >= DAILY_BUDGET_USD) return empty({ ok: true, reason: 'daily_budget' });
  const since = last > 0 ? Math.max(last, nowS - MAX_LOOKBACK_S) : nowS - 3600; // primera vez: última hora
  if (nowS - since < 60) return empty({ ok: true, reason: 'too_soon' });

  // Ventanas de WINDOW_MIN minutos, de la más nueva a la más vieja.
  const windows: { from: number; to: number }[] = [];
  for (let i = 0; i < MAX_WINDOWS; i++) {
    const to = nowS - i * WINDOW_MIN * 60;
    const from = Math.max(since, to - WINDOW_MIN * 60);
    if (to - from < 60) break;
    windows.push({ from, to });
    if (from <= since) break;
  }
  const tasks = windows.flatMap((w) => X_QUERIES.map((q) => `${q} since_time:${w.from} until_time:${w.to}`));

  const deadline = Date.now() + TIME_BUDGET_MS;
  const tweets: RawTweet[] = [];
  let calls = 0, failed = 0, units = 0, next = 0, fatal = false;
  let firstError: string | undefined;
  const worker = async () => {
    while (next < tasks.length && Date.now() < deadline && !fatal) {
      const query = tasks[next++];
      calls++;
      try {
        const r = await searchTweets(query);
        tweets.push(...r.tweets);
        units += Math.max(1, r.tweets.length);
      } catch (e) {
        failed++;
        const code = e instanceof XApiError ? (e.status ? `HTTP ${e.status}` : e.message) : (e as Error).name === 'AbortError' ? 'timeout' : 'red';
        firstError ??= code;
        if (e instanceof XApiError && [401, 402, 403].includes(e.status)) fatal = true; // clave inválida o sin saldo: no tiene sentido seguir
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const partial = next < tasks.length || failed > 0;
  const estimatedCostUsd = Number((units * COST_PER_UNIT_USD).toFixed(5));

  if (calls > 0 && failed === calls) {
    // Nada respondió: NO se avanza el reloj (la próxima corrida reintenta el mismo tramo) y se guarda el motivo.
    await admin.from('x_scan_state').update({ last_error: firstError ?? 'sin respuesta' }).eq('id', 1);
    return empty({ reason: 'upstream', calls, failed, firstError, partial: true });
  }

  const rows = new Map<string, MentionRow>();
  for (const t of tweets) {
    const text = (t.text ?? '').trim();
    if (!t.id || !text) continue;
    const ts = Date.parse(t.createdAt ?? '');
    const author = t.author?.userName ?? '';
    for (const m of extractMentions(text)) {
      rows.set(`${t.id}|${m.term}`, {
        tweet_id: t.id, term: m.term, kind: m.kind, author: isXUser(author) ? author : '', lang: t.lang ?? null, body: text.slice(0, 400),
        likes: t.likeCount ?? 0, retweets: t.retweetCount ?? 0, replies: t.replyCount ?? 0, views: t.viewCount ?? 0,
        tweeted_at: new Date(Number.isFinite(ts) ? ts : Date.now()).toISOString(),
      });
    }
  }
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 200) {
    const { error } = await admin.from('x_mentions').upsert(list.slice(i, i + 200), { onConflict: 'tweet_id,term', ignoreDuplicates: true });
    if (error) {
      await admin.from('x_scan_state').update({ last_error: 'storage' }).eq('id', 1);
      return empty({ reason: 'storage', calls, failed, tweets: tweets.length, firstError: error.message, partial: true });
    }
  }

  await admin.from('x_scan_state').update({ last_until: nowS, updated_at: new Date().toISOString() }).eq('id', 1);
  // Estas columnas llegan con la migración 0006: si aún no existe, el fallo se ignora y el escaneo igual vale.
  await admin.from('x_scan_state').update({ last_error: firstError ? `parcial: ${firstError}` : null, spent_day: today, spent_usd: spentToday + estimatedCostUsd }).eq('id', 1);
  // Retención: 3 días (el ranking más largo es de 24 h).
  await admin.from('x_mentions').delete().lt('tweeted_at', new Date(Date.now() - 3 * 86_400_000).toISOString());

  return { ok: true, ran: true, calls, failed, tweets: tweets.length, mentions: list.length, estimatedCostUsd, firstError, partial };
}
