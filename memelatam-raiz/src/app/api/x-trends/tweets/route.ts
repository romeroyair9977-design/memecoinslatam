import { NextResponse } from 'next/server';
import { cached } from '@/lib/cache';
import { isValidTerm, isXUser } from '@/lib/xmentions';
import { translateToEs } from '@/lib/services/translate';
import { createPublicSupabase } from '@/lib/supabase/server';
import type { XTweet } from '@/types/xtrends';

export const dynamic = 'force-dynamic';

interface Row {
  tweet_id: string; author: string; lang: string | null; body: string;
  likes: number; retweets: number; replies: number; views: number | string; tweeted_at: string;
}

/** GET /api/x-trends/tweets?term=$pepe&hours=24 → los tweets con más engagement, traducidos al español si hay DeepL. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const term = q.get('term') ?? '';
  const h = Number(q.get('hours') ?? 24);
  const hours = h === 1 || h === 6 ? h : 24;
  if (!isValidTerm(term)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const sb = createPublicSupabase();
  if (!sb) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  try {
    const tweets = await cached(`xtweets:${term}:${hours}`, 10 * 60_000, async (): Promise<XTweet[]> => {
      const { data, error } = await sb.rpc('x_top_tweets', { p_term: term, p_hours: hours, p_limit: 3 });
      if (error) throw new Error('db');
      const rows = (data ?? []) as Row[];

      // Solo se traducen los que no están en español (ahorra cuota de DeepL).
      const needs = rows.map((r) => r.lang !== 'es');
      const toTranslate = rows.filter((_, i) => needs[i]).map((r) => r.body);
      const translated = await translateToEs(toTranslate);
      let t = 0;

      return rows.map((r, i) => ({
        id: r.tweet_id,
        author: r.author,
        text: r.body,
        textEs: needs[i] ? translated[t++] ?? null : null,
        lang: r.lang,
        likes: r.likes,
        retweets: r.retweets,
        replies: r.replies,
        views: Number(r.views),
        at: r.tweeted_at,
        url: isXUser(r.author) ? `https://x.com/${r.author}/status/${r.tweet_id}` : null,
      }));
    });
    return NextResponse.json({ tweets }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
