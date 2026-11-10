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

/** `timeoutMs`: tiempo máximo de esta consulta. El escaneo lo ajusta al tiempo que le queda para no pasarse del límite de Netlify. */
export async function searchTweets(query: string, cursor?: string, timeoutMs = 7_000): Promise<{ tweets: RawTweet[]; next: string | null }> {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) throw new XApiError(0, 'Falta la variable TWITTERAPI_IO_KEY');

  const params = new URLSearchParams({ query, queryType: 'Latest' });
  if (cursor) params.set('cursor', cursor);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

export interface XUser {
  userName: string;
  name: string;
  followers: number;
  createdAt: string;
  isBlueVerified: boolean;
  description: string;
  /** Sitios que el perfil declara (campo URL y enlaces de la bio) */
  urls: string[];
}

/** Perfil de una cuenta de X. null si no existe, está suspendida o la API no responde con datos. */
export async function getUserInfo(userName: string): Promise<XUser | null> {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) throw new XApiError(0, 'Falta la variable TWITTERAPI_IO_KEY');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7_000);
  try {
    const res = await fetch(`${BASE}/twitter/user/info?userName=${encodeURIComponent(userName)}`, {
      headers: { 'X-API-Key': key, accept: 'application/json' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new XApiError(res.status, `twitterapi.io respondió ${res.status}`);
    const body = (await res.json()) as {
      status?: string;
      data?: {
        userName?: string; name?: string; followers?: number; createdAt?: string; isBlueVerified?: boolean; description?: string; unavailable?: boolean;
        profile_bio?: { entities?: { url?: { urls?: { expanded_url?: string }[] }; description?: { urls?: { expanded_url?: string }[] } } };
      };
    };
    const d = body.data;
    if (body.status === 'error' || !d || !d.userName || d.unavailable) return null;
    const urls = [...(d.profile_bio?.entities?.url?.urls ?? []), ...(d.profile_bio?.entities?.description?.urls ?? [])]
      .map((u) => u.expanded_url)
      .filter((u): u is string => !!u);
    return {
      userName: d.userName,
      name: d.name ?? d.userName,
      followers: d.followers ?? 0,
      createdAt: d.createdAt ?? '',
      isBlueVerified: Boolean(d.isBlueVerified),
      description: d.description ?? '',
      urls,
    };
  } finally {
    clearTimeout(timer);
  }
}
