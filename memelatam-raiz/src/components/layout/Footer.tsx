import Link from 'next/link';
import { SITE } from '@/lib/config';

export function Footer() {
  return (
    <footer className="border-t border-line py-6 text-center text-xs text-muted">
      <div className="mx-auto max-w-3xl space-y-2 px-4">
        <p>
          {SITE.name} no da asesoría financiera. Los datos vienen de DexScreener, GeckoTerminal y RugCheck y pueden
          tener retraso o errores. Haz tu propia investigación.
        </p>
        <p>
          <a href={SITE.parentUrl} className="hover:text-ink">{SITE.brand}</a>
          {' · '}
          <Link href="/privacidad" className="hover:text-ink">Privacidad y publicidad</Link>
        </p>
      </div>
    </footer>
  );
}
