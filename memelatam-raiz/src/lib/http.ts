export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

interface FetchOpts {
  /** Segundos que Next puede reutilizar la respuesta (Data Cache) */
  revalidate?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** fetch JSON con timeout y errores tipados. Solo para uso en servidor. */
export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', ...opts.headers },
      next: { revalidate: opts.revalidate ?? 30 },
    });
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} en ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
