import type { Metadata } from 'next';
import { TrendsBoard } from '@/components/social/TrendsBoard';

export const metadata: Metadata = {
  title: 'Lo que se habla en X: memecoins en tendencia',
  description: 'Ranking de las memecoins más mencionadas en X en la última hora, 6 horas y 24 horas, en cualquier idioma, con análisis de holders y riesgo.',
};

export default function TendenciasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Lo que se habla en X</h1>
        <p className="mt-1 text-muted">Las memecoins más mencionadas ahora, en cualquier idioma. Caza la narrativa antes de que explote el volumen.</p>
      </header>
      <TrendsBoard />
    </div>
  );
}
