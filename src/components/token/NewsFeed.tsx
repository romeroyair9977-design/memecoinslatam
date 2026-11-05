import { ExternalLink } from 'lucide-react';
import type { SocialLink } from '@/types/token';

interface Props {
  symbol: string;
  name: string;
  address: string;
  links: SocialLink[];
}

const LABELS: Record<string, string> = { twitter: 'X (Twitter)', telegram: 'Telegram', discord: 'Discord', website: 'Sitio web' };

/**
 * MVP: enlaces oficiales + búsquedas en vivo (X, Google Noticias). No usa APIs de pago.
 * Fase 2: ingestar menciones reales (X API / Nitter-like / LunarCrush) y guardarlas en Supabase.
 */
export function NewsFeed({ symbol, name, address, links }: Props) {
  const q = encodeURIComponent(`$${symbol} OR "${name}" OR ${address}`);
  const searches = [
    { label: `Menciones de $${symbol} en X (en vivo)`, url: `https://x.com/search?q=${q}&f=live` },
    { label: 'Noticias en Google', url: `https://news.google.com/search?q=${encodeURIComponent(`${name} ${symbol} crypto`)}` },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted">Canales oficiales</h3>
        {links.length ? (
          <ul className="flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-sm hover:border-brand/60">
                  {LABELS[l.type] ?? l.label ?? l.type}
                  <ExternalLink className="h-3 w-3 text-muted" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Este token no tiene redes ni web registradas. Es una señal de alerta.</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted">Qué se dice afuera</h3>
        <ul className="space-y-1">
          {searches.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm hover:text-brand">
                {s.label}<ExternalLink className="h-3 w-3 text-muted" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
