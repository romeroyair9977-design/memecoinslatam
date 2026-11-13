import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { ALIVE_RULE, PREDICTION_COST, PREDICTION_PAYOUT } from '@/lib/predictions';
import { ADSENSE } from '@/lib/config';
import { formatLatam } from '@/lib/latam';
import { getLeaderboard } from '@/lib/services/predictions';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'Predictores',
  description: 'Quiénes aciertan cuánto dura una memecoin. Ranking público de la comunidad latina.',
};

export default async function RankingPage() {
  const rows = isSupabaseConfigured ? await getLeaderboard(50) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Ranking de predictores</h1>
        <p className="text-muted">
          Cada persona apuesta {formatLatam(PREDICTION_COST)} a si una memecoin seguirá viva en 7, 30 o 90 días. Si acierta recibe {formatLatam(PREDICTION_PAYOUT)}. Así se ve quién entiende de verdad qué tokens perduran.
        </p>
        <p className="text-xs text-muted">{ALIVE_RULE} Las predicciones se resuelven solas cuando vence el plazo; la primera tanda se resuelve a los 7 días.</p>
      </header>

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">El ranking se activa al conectar Supabase.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          Todavía nadie ha hecho una predicción. Abre cualquier token y sé el primero en <Link href="/#dashboard" className="text-brand hover:underline">predecir</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-muted">
              <tr>
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Usuario</th>
                <th className="p-3 text-right font-medium">Aciertos</th>
                <th className="p-3 text-right font-medium">Fallos</th>
                <th className="p-3 text-right font-medium">% acierto</th>
                <th className="p-3 text-right font-medium">Abiertas</th>
                <th className="p-3 text-right font-medium">Neto $LATAM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const done = r.wins + r.losses;
                return (
                  <tr key={r.user_id} className="border-t border-line">
                    <td className="p-3 text-muted">{i + 1}</td>
                    <td className="p-3"><Link href={`/perfil/${r.username}`} className="font-medium hover:text-brand">@{r.username}</Link></td>
                    <td className="p-3 text-right text-emerald-400">{r.wins}</td>
                    <td className="p-3 text-right text-rose-400">{r.losses}</td>
                    <td className="p-3 text-right">{done > 0 ? `${Math.round((r.wins / done) * 100)}%` : '—'}</td>
                    <td className="p-3 text-right text-muted">{r.open_count}</td>
                    <td className="p-3 text-right">{r.net_latam > 0 ? '+' : ''}{r.net_latam}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdSlot slot={ADSENSE.slotRanking} />
    </div>
  );
}
