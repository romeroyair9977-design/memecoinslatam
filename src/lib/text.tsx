import Link from 'next/link';
import type { ReactNode } from 'react';
import { detectAddressKind } from '@/lib/addresses';
import { shortAddress } from '@/lib/utils';

// URLs http(s), o palabras largas candidatas a contract address, o $TICKER.
const TOKEN_RE = /(https?:\/\/[^\s<]+)|(\b0x[a-fA-F0-9]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)|(\$[A-Za-z][A-Za-z0-9]{1,14}\b)/g;

/**
 * Convierte texto plano del chat en nodos React: links externos seguros, contract addresses que
 * llevan al análisis, y $TICKERs resaltados. Nunca usa dangerouslySetInnerHTML.
 */
export function renderBody(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const [full, url, addr, ticker] = m;
    if (url) {
      out.push(
        <a key={i++} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all text-sky-300 underline-offset-2 hover:underline">
          {url.length > 48 ? `${url.slice(0, 45)}…` : url}
        </a>,
      );
    } else if (addr && detectAddressKind(addr)) {
      out.push(
        <Link key={i++} href={`/token/${addr}`} className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-xs text-brand hover:underline" title="Analizar este contrato">
          {shortAddress(addr, 4)}
        </Link>,
      );
    } else if (ticker) {
      out.push(<span key={i++} className="font-medium text-brand">{ticker}</span>);
    } else {
      out.push(full);
    }
    last = idx + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
