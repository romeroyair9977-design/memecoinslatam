import type { Metadata } from 'next';
import { ScanClient } from '@/components/scan/ScanClient';

export const metadata: Metadata = {
  title: 'Ranking de memecoins por ciclos',
  description: 'Qué memecoins han sobrevivido 1, 2 y 3 ciclos de vida, y cuáles casi no tienen opción de llegar al siguiente.',
};

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Ranking de memecoins</h1>
        <p className="max-w-3xl text-muted">
          Las memecoins ordenadas por cuántos ciclos de vida han sobrevivido: Ciclo 1 (pasó el lanzamiento, entre 1 y 7 días), Ciclo 2 (llegó a 7 días) y Ciclo 3 (30 días o más). En el Ciclo 1 y 2 mostramos qué opción tiene cada una de llegar al siguiente, para que veas cuáles casi seguro se apagan.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          Solo cuentan las que siguen vivas (liquidez de al menos 5.000 USD y volumen de al menos 1.000 USD al día). La edad es la del pool principal. La opción de llegar al siguiente ciclo es una heurística sobre liquidez, volumen, presión de venta y concentración: no es una predicción.
        </p>
      </header>
      <ScanClient />
    </div>
  );
}
