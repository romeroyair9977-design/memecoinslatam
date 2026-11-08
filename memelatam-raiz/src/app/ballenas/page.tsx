import type { Metadata } from 'next';
import { WhalesClient } from '@/components/whales/WhalesClient';

export const metadata: Metadata = {
  title: 'Ballenas',
  description: 'Quién tiene la mayor parte de cada memecoin y cuánto caería el precio si las ballenas venden.',
};

export default function WhalesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Ballenas</h1>
        <p className="max-w-3xl text-muted">
          Las wallets que concentran el supply de cada memecoin, con el valor de lo que tienen en dólares. Para cada token calculamos qué pasaría con el precio si vende la ballena #1, las dos primeras, las tres o las cinco: si una sola venta lo hunde, ese token depende de una persona.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          Por ahora solo Solana (RugCheck es la única fuente gratuita con holders uno a uno). Se excluyen las cuentas de los pools de liquidez. Los escenarios son una estimación, no una predicción.
        </p>
      </header>
      <WhalesClient />
    </div>
  );
}
