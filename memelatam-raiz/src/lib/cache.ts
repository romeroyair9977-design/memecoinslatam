/**
 * Cache en memoria con TTL + deduplicación de requests en vuelo.
 * Limitación: es por instancia del servidor (en serverless no se comparte).
 * Para producción: reemplazar por Upstash Redis / Vercel KV con la misma firma.
 */
interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = loader()
    .then((value) => {
      if (store.size >= MAX_ENTRIES) prune();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key)); // los errores NO se cachean

  inflight.set(key, p);
  return p;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
  // si sigue lleno, elimina las más antiguas
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}
