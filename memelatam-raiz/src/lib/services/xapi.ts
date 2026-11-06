import 'server-only';

/**
 * Cliente mínimo de twitterapi.io. La API key se lee SOLO de la variable de entorno TWITTERAPI_IO_KEY
 * (servidor). Nunca la pongas en el código ni en variables NEXT_PUBLIC_*.
 * Precio de referencia: unos 0,00015 USD por tweet devuelto (≈ 0,15 USD cada 1.000).
 */
const BASE = 'https://api.twitterapi.io';

export interface RawTweet {
  id: string;
  text?: string;
  lang?: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewCount?: number;
  author?: { userName?: string };
}

export class XApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'XApiError';
  }
}

export async function searchTweets(query: string, cursor?: string): Promise<{ tweets: RawTweet[]; next: string | null }> {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) throw new XApiError(0, 'Falta la variable TWITTERAPI_IO_KEY');

  const params = new URLSearchParams({ query, queryType: 'Latest' });
  if (cursor) params.set('cursor', cursor);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7_000); // las funciones de Netlify cortan a los ~10 s
  try {
    const res = await fetch(`${BASE}/twitter/tweet/advanced_search?${params.toString()}`, {
      headers: { 'X-API-Key': key, accept: 'application/json' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new XApiError(res.status, `twitterapi.io respondió ${res.status}`);
    const data = (await res.json()) as { tweets?: RawTweet[]; has_next_page?: boolean; next_cursor?: string };
    return {
      tweets: Array.isArray(data.tweets) ? data.tweets : [],
      next: data.has_next_page && data.next_cursor ? data.next_cursor : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
