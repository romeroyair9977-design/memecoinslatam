import type { Metadata } from 'next';
import { FomoClient } from '@/components/fomo/FomoClient';

export const metadata: Metadata = {
  title: 'FOMO en vivo',
  description: 'Las memecoins donde más rápido están entrando compras ahora mismo, en Solana y Base, con filtros de agentes de IA y equipo visible.',
};

export default function FomoPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">FOMO en vivo</h1>
        <p className="max-w-3xl text-muted">
          Las memecoins donde más rápido están entrando compras ahora mismo. Para cada una medimos cuántas compras por minuto hay en los últimos 5 minutos, qué tanto se aceleran frente al resto de la hora y qué porcentaje de las operaciones son compras. Así ves las que explotan desde que nacen, antes de que lleguen a las listas de siempre.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          «Mejor calidad» mezcla el FOMO con equipo visible (cuenta de X y sitio web) y liquidez, para que no suban solo las más arriesgadas. La ventana más corta que ofrece la fuente es de 5 minutos y se cuentan compras, no personas distintas. «Posible IA» se detecta por palabras en el nombre o la descripción. El FOMO es una señal de atención, no de seguridad: revisa siempre holders, ballenas y quién está detrás antes de decidir.
        </p>
      </header>
      <FomoClient />
    </div>
  );
}
