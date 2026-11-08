import type { Metadata } from 'next';
import { PotentialBoard } from '@/components/potential/PotentialBoard';
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
          Memecoins que Veltrix ve con escenario de x10, x100 o x1000. Cada llamado queda guardado con su fecha, el market cap de entrada y la meta, y después se marca como cumplido o fallado. El historial es público para que puedas juzgar cuánto aciertan estos llamados.
        </p>
        <p className="max-w-3xl text-xs text-muted">
          Un x1000 es rarísimo y solo se publica si el token es muy pequeño y cumple criterios estrictos. Son escenarios con reglas transparentes (liquidez, volumen, compras, holders, actividad), no promesas ni asesoría financiera. La mayoría de las memecoins pierde valor.
        </p>
      </header>
      {isSupabaseConfigured ? (
        <PotentialBoard calls={calls} />
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Esta sección se activa al conectar Supabase y configurar el cron de Potencial (ver README).</p>
      )}
    </div>
  );
}
