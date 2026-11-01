/** Solo permite redirecciones internas (evita open-redirect vía ?next=https://malo.com o //malo.com). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
