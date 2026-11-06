import 'server-only';

/**
 * Traducción al español con DeepL (plan gratuito: 500.000 caracteres/mes). Es opcional: sin DEEPL_API_KEY devuelve
 * null y la interfaz ofrece un enlace a Google Traductor. Cambiar de proveedor = tocar solo este archivo.
 */
export async function translateToEs(texts: string[]): Promise<(string | null)[]> {
  const none = texts.map(() => null);
  const key = process.env.DEEPL_API_KEY;
  if (!key || texts.length === 0) return none;

  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: 'ES' }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return none;
    const data = (await res.json()) as { translations?: { text: string }[] };
    return texts.map((_, i) => data.translations?.[i]?.text ?? null);
  } catch {
    return none;
  } finally {
    clearTimeout(timer);
  }
}
