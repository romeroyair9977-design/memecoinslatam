import type { Metadata } from 'next';
import { XTrendsClient } from '@/components/xtrends/XTrendsClient';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Tendencias en X',
  description: `Las memecoins más mencionadas en X en la última hora, 6 horas y 24 horas, con traducción al español. ${SITE.name}.`,
};

export default function XTrendsPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Tendencias en X</h1>
        <p className="max-w-3xl text-muted">
          Las memecoins de las que más se habla en X, en cualquier idioma. Mira cuántas menciones tiene cada una, cuánto engagement generan y si el ritmo está subiendo. Toca un token para ver los tweets traducidos al español.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          Es una muestra de menciones públicas de X (no todas), filtrada para evitar spam: solo cuentan tokens mencionados por al menos 2 cuentas distintas. Muchas menciones no significan que un token sea bueno ni seguro: revisa siempre holders y liquidez antes de decidir.
        </p>
      </header>
      <XTrendsClient />
    </div>
  );
}
