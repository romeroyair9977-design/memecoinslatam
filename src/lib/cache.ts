/**
 * Cache en memoria con TTL + deduplicación de requests en vuelo + "stale-while-revalidate".
 *
 *  - Dentro del TTL: devuelve el valor al instante.
 *  - Pasado el TTL pero dentro de `staleMs`: devuelve el valor viejo AL INSTANTE y recalcula en segundo plano
 *    (el usuario nunca espera a las APIs externas salvo en el primer arranque en frío).
 *  - Los errores NO se cachean; si el recálculo en segundo plano falla se sigue sirviendo el dato viejo.
 *
 * Limitación: es por instancia del servidor (en serverless no se comparte).
 * Para producción: reemplazar por Upstash Redis / Vercel KV con la misma firma.
 */
interface Entry {
  value: unknown;
  expires: number;
  staleUntil: number;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

function load<T>(key: string, ttlMs: number, staleMs: number, loader: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = loader()
    .then((value) => {
      if (store.size >= MAX_ENTRIES) prune();
      const now = Date.now();
      store.set(key, { value, expires: now + ttlMs, staleUntil: now + ttlMs + staleMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>, staleMs = 0): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value as T;
  if (hit && hit.staleUntil > now) {
    void load(key, ttlMs, staleMs, loader).catch(() => undefined); // refresca sin hacer esperar a nadie
    return hit.value as T;
  }
  return load(key, ttlMs, staleMs, loader);
}

/** Promesa con límite de tiempo: si la fuente tarda más, devuelve `fallback` en vez de frenar todo. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

function prune() {
  const now = Date.now();
  for (const [k, v] of store) if (v.staleUntil <= now) store.delete(k);
  // si sigue lleno, elimina las más antiguas
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}
