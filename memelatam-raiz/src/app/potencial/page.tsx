import type { Metadata } from 'next';
import Link from 'next/link';
import { TokenAvatar } from '@/components/token/TokenCard';
import { chainLabel } from '@/lib/chains';
import { computeStats, multipleOf, TIER_DAYS, type CallRow, type Tier } from '@/lib/potencial';
import { getScanCalls } from '@/lib/services/scancalls';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { formatAge } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Radar x10 · x100 · x1000: memecoins con potencial y su historial de aciertos',
  description: 'El scan elige memecoins con reglas de calidad, anota el precio de entrada y la meta (x10, x100, x1000) y cuenta públicamente cuántas llegan y cuántas no.',
};
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
const mult = (m: number) => `x${m >= 10 ? Math.round(m) : m.toFixed(1)}`;

function Progress({ current, target }: { current: number; target: Tier }) {
  const p = current > 1 ? Math.min(1, Math.log(current) / Math.log(target)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-panel2" role="img" aria-label={`Va en ${mult(current)} de x${target}`}>
      <div className="h-full bg-brand" style={{ width: `${Math.round(p * 100)}%` }} />
    </div>
  );
}

function OpenRow({ r }: { r: CallRow }) {
  const cur = multipleOf(r.lastPrice, r.entryPrice);
  const peak = multipleOf(r.peakPrice, r.entryPrice);
  const left = Math.max(0, Math.ceil((r.expiresAt - Date.now()) / DAY));
  return (
    <li>
      <Link href={`/token/${r.address}?chain=${r.chain}`} className="block rounded-xl border border-line bg-panel p-3 transition-colors hover:border-brand/60">
        <div className="flex items-center gap-3">
          <TokenAvatar src={r.imageUrl} symbol={r.symbol} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.symbol} <span className="text-sm font-normal text-muted">{r.name}</span></p>
            <p suppressHydrationWarning className="text-xs text-muted">{chainLabel(r.chain)} · llamada {formatAge(r.calledAt)} · quedan {left} {left === 1 ? 'día' : 'días'}</p>
          </div>
          <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">Meta x{r.target}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <Progress current={peak} target={r.target} />
          <p className="flex justify-between text-xs text-muted"><span>Ahora {mult(cur)} · pico {mult(peak)}</span><span>MC de entrada ${Math.round(r.entryMcap / 1000)}K</span></p>
        </div>
        {r.reasons.length > 0 && <p className="mt-2 text-xs text-muted">{r.reasons[1] ?? r.reasons[0]}</p>}
      </Link>
    </li>
  );
}

export default async function PotencialPage() {
  const rows = await getScanCalls();
  const stats = computeStats(rows);
  const open = rows.filter((r) => r.status === 'open').sort((a, b) => b.calledAt - a.calledAt);
  const done = rows.filter((r) => r.status !== 'open').sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)).slice(0, 40);

  return (
    <div className="space-y-8">
      <header className="space-y-2 pt-2">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Radar x10 · x100 · x1000</h1>
        <p className="max-w-3xl text-muted">
          El scan revisa solo las memecoins y anota las que pasan sus reglas de calidad: liquidez, volumen, más compras que ventas, holders no concentrados y un market cap con espacio para crecer.
          En ese momento guarda el precio de entrada y se pone una meta: <strong className="font-medium text-ink">x10, x100 o x1000</strong>. Después mide si la alcanzó.
        </p>
        <p className="max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Esto <strong>no es una promesa ni un consejo de inversión</strong>. Casi todas las memecoins fallan, y las metas altas son muy difíciles. Por eso el historial es público: cada llamada queda registrada con su precio de entrada y las fallidas se cuentan igual que las acertadas. Mira la tasa real antes de confiar en el radar.
        </p>
      </header>

      <section aria-label="Tasa de aciertos" className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.tier} className="rounded-xl border border-line bg-panel p-4">
            <p className="text-sm text-muted">Meta <span className="font-semibold text-ink">x{s.tier}</span> · plazo {TIER_DAYS[s.tier]} días</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`}</p>
            <p className="text-xs text-muted">{s.rate === null ? 'Aún no hay llamadas resueltas' : 'de acierto en llamadas resueltas'}</p>
            <p className="mt-3 text-xs text-muted">{s.hits} acertadas · {s.misses} fallidas · {s.open} en curso</p>
            <p className="text-xs text-muted">Mejor pico medido: {s.bestMultiple > 0 ? mult(s.bestMultiple) : '—'}</p>
          </div>
        ))}
      </section>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          {isSupabaseConfigured
            ? 'Todavía no hay llamadas registradas. El radar empieza a anotarlas cuando el cron de scan-calls corre por primera vez y encuentra candidatas.'
            : 'El radar se activa al conectar Supabase.'}
        </p>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <div><h2 className="font-display text-xl font-semibold">En curso</h2><p className="text-sm text-muted">Llamadas abiertas: todavía no llegan a la meta ni se les acaba el plazo.</p></div>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{open.map((r) => <OpenRow key={r.id} r={r} />)}</ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <div><h2 className="font-display text-xl font-semibold">Resultados</h2><p className="text-sm text-muted">Las más recientes ya resueltas, con acierto o sin él.</p></div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-panel text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Token</th>
                  <th className="p-3 font-medium">Meta</th>
                  <th className="p-3 text-right font-medium">Pico</th>
                  <th className="p-3 font-medium">Resultado</th>
                  <th className="p-3 font-medium">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="p-3"><Link href={`/token/${r.address}?chain=${r.chain}`} className="font-medium hover:text-brand">{r.symbol}</Link> <span className="text-xs text-muted">{chainLabel(r.chain)}</span></td>
                    <td className="p-3">x{r.target}</td>
                    <td className="p-3 text-right">{mult(multipleOf(r.peakPrice, r.entryPrice))}</td>
                    <td className="p-3">{r.status === 'hit' ? <span className="text-emerald-400">✅ Llegó</span> : <span className="text-rose-400">❌ No llegó</span>}</td>
                    <td suppressHydrationWarning className="p-3 text-muted">{formatAge(r.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted">
        Cómo se mide: el precio se revisa cada 30 minutos (el pico puede quedarse corto si sube y baja entre dos revisiones). Un pico solo cuenta si el token tenía al menos $3K de liquidez. Cada token se llama una sola vez. Para ver el token completo, holders y ballenas, ábrelo desde aquí o desde el <Link href="/scan" className="text-brand hover:underline">Scan</Link>.
      </p>
    </div>
  );
}
