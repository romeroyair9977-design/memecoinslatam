import { NextResponse } from 'next/server';
import { searchTweets, type RawTweet } from '@/lib/services/xapi';
import { createAdminSupabase } from '@/lib/supabase/server';
import { X_QUERIES, extractMentions, isXUser } from '@/lib/xmentions';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Páginas por consulta (cada página ≈ 20 tweets). Súbelo con X_MAX_PAGES solo si tu plan de twitterapi.io lo aguanta. */
const MAX_PAGES = Math.min(3, Math.max(1, Number(process.env.X_MAX_PAGES ?? 1) || 1));
const MAX_LOOKBACK_S = 2 * 3600;
const COST_PER_TWEET_USD = 0.00015;

interface MentionRow {
  tweet_id: string; term: string; kind: 'cashtag' | 'address'; author: string; lang: string | null; body: string;
  likes: number; retweets: number; replies: number; views: number; tweeted_at: string;
}

/**
 * Escanea X y guarda las menciones nuevas. Llámala cada 15–30 min con un cron externo gratuito (cron-job.org):
 *   GET https://TU-DOMINIO/api/cron/x-scan     Cabecera:  Authorization: Bearer <CRON_SECRET>
 * Cada corrida pide solo los tweets desde la anterior (since_time/until_time), así no se paga dos veces por lo mismo.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!process.env.TWITTERAPI_IO_KEY) return NextResponse.json({ error: 'Falta TWITTERAPI_IO_KEY' }, { status: 500 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  const { data: state } = await admin.from('x_scan_state').select('last_until').eq('id', 1).maybeSingle();
  const now = Math.floor(Date.now() / 1000);
  const last = Number(state?.last_until ?? 0);
  const since = last > 0 ? Math.max(last, now - MAX_LOOKBACK_S) : now - 3600; // primera vez: última hora
  if (now - since < 60) return NextResponse.json({ skipped: 'Corrió hace menos de un minuto' });
  const range = `since_time:${since} until_time:${now}`;

  // Las consultas van en paralelo (una por tema); las páginas de cada una, en serie.
  const settled = await Promise.allSettled(
    X_QUERIES.map(async (q) => {
      const tweets: RawTweet[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const r = await searchTweets(`${q} ${range}`, cursor);
        tweets.push(...r.tweets);
        if (!r.next) break;
        cursor = r.next;
      }
      return tweets;
    }),
  );
  const failures = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failures.length === X_QUERIES.length) {
    // Nada respondió: NO avanzamos el reloj, así la próxima corrida reintenta el mismo tramo.
    return NextResponse.json({ error: 'twitterapi.io no respondió', detail: String((failures[0].reason as Error)?.message ?? failures[0].reason) }, { status: 502 });
  }
  const tweets = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));

  const rows = new Map<string, MentionRow>();
  for (const t of tweets) {
    const text = (t.text ?? '').trim();
    if (!t.id || !text) continue;
    const ts = Date.parse(t.createdAt ?? '');
    const author = t.author?.userName ?? '';
    for (const m of extractMentions(text)) {
      rows.set(`${t.id}|${m.term}`, {
        tweet_id: t.id,
        term: m.term,
        kind: m.kind,
        author: isXUser(author) ? author : '',
        lang: t.lang ?? null,
        body: text.slice(0, 400),
        likes: t.likeCount ?? 0,
        retweets: t.retweetCount ?? 0,
        replies: t.replyCount ?? 0,
        views: t.viewCount ?? 0,
        tweeted_at: new Date(Number.isFinite(ts) ? ts : Date.now()).toISOString(),
      });
    }
  }

  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 200) {
    const { error } = await admin.from('x_mentions').upsert(list.slice(i, i + 200), { onConflict: 'tweet_id,term', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'No se pudieron guardar las menciones', detail: error.message }, { status: 500 });
  }

  await admin.from('x_scan_state').update({ last_until: now, updated_at: new Date().toISOString() }).eq('id', 1);
  // Retención: 3 días (el ranking más largo es de 24 h).
  await admin.from('x_mentions').delete().lt('tweeted_at', new Date(Date.now() - 3 * 86_400_000).toISOString());

  return NextResponse.json({
    tweets: tweets.length,
    mentions: list.length,
    queriesFailed: failures.length,
    estimatedCostUsd: Number((tweets.length * COST_PER_TWEET_USD).toFixed(5)),
  });
}
