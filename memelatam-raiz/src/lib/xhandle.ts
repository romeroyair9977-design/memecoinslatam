import type { SocialLink } from '@/types/token';

/** Rutas de x.com que NO son un perfil. */
const RESERVED = new Set(['i', 'intent', 'search', 'home', 'share', 'hashtag', 'explore', 'messages', 'notifications', 'settings', 'compose', 'login', 'signup', 'tos', 'privacy']);
const X_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i;

export interface XRef { handle: string; isTweetLink: boolean }

/** Saca el usuario de X de los enlaces del token (DexScreener / GeckoTerminal). */
export function extractXHandle(links: SocialLink[]): XRef | null {
  for (const l of links) {
    const m = X_URL.exec(l.url.trim());
    if (!m || RESERVED.has(m[1].toLowerCase())) continue;
    return { handle: m[1], isTweetLink: /\/status\//i.test(l.url) };
  }
  return null;
}

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

/** Nombre normalizado para comparar ("Float Official" ≈ "FLOAT-official"). */
export const normName = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
