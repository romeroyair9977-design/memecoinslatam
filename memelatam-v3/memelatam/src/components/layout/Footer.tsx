import { SITE } from '@/lib/config';

export function Footer() {
  return (
    <footer className="border-t border-line py-6 text-center text-xs text-muted">
      <p>
        {SITE.name} no da asesoría financiera. Los datos vienen de DexScreener, GeckoTerminal y RugCheck y pueden
        tener retraso o errores. Haz tu propia investigación.
      </p>
    </footer>
  );
}
