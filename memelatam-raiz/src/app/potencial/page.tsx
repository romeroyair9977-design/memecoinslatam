import type { Metadata } from 'next';
import { PotentialBoard } from '@/components/potential/PotentialBoard';
import { PotentialDiagnostics } from '@/components/potential/PotentialDiagnostics';
import { getCalls } from '@/lib/services/potential';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const revalidate = 30;
export const metadata: Metadata = {
  title: 'Potencial x10, x100 y x1000',
  description: 'Los llamados de Veltrix a x10, x100 y x1000, con el market cap necesario y el historial de aciertos y fallos.',
};

export default async function PotentialPage() {
  const calls = isSupabaseConfigured ? await getCalls() : [];
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Potencial</h1>
        <p className="max-w-3xl text-muted">
          Memecoins nuevas con FOMO real que Veltrix sigue desde su entrada, por niveles de x10, x100 y x1000. Cada llamado queda guardado con su fecha, el market cap de entrada y la meta, y después se marca como cumplido o fallado. El historial es público para que puedas juzgar cuánto aciertan estos llamados.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          Se publican solos, con reglas visibles: moneda de menos de 72 horas, liquidez de al menos 8.000 USD, FOMO alto con mayoría de compras y, en Solana, sin mint ni freeze activos y con el top 10 por debajo de 60%. Un x10 parte de market caps de hasta 1 M, un x100 de hasta 100 K y un x1000 de hasta 25 K. Son escenarios, no promesas ni asesoría financiera: la mayoría de las memecoins pierde valor.
        </p>
      </header>
      {isSupabaseConfigured ? (
        <>
          <PotentialBoard calls={calls} />
          <PotentialDiagnostics />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Esta sección se activa al conectar Supabase y configurar el cron de Potencial (ver README).</p>
      )}
    </div>
  );
}
