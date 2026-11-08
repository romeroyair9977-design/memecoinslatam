'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck, UserX } from 'lucide-react';
import { chainLabel, explorerUrl } from '@/lib/chains';
import type { NoteTone, TeamReport, TeamVerdict } from '@/lib/team';
import { cn, formatUsd, shortAddress } from '@/lib/utils';

const VERDICT: Record<TeamVerdict, { cls: string; Icon: typeof Info }> = {
  verificado: { cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', Icon: ShieldCheck },
  parcial: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200', Icon: AlertTriangle },
  sin_equipo: { cls: 'border-rose-500/40 bg-rose-500/10 text-rose-200', Icon: UserX },
  posible_imitacion: { cls: 'border-rose-500/50 bg-rose-500/15 text-rose-100', Icon: ShieldAlert },
};
const NOTE: Record<NoteTone, { Icon: typeof Info; cls: string }> = {
  good: { Icon: CheckCircle2, cls: 'text-emerald-400' },
  warn: { Icon: AlertTriangle, cls: 'text-amber-400' },
  bad: { Icon: ShieldAlert, cls: 'text-rose-400' },
  info: { Icon: Info, cls: 'text-sky-400' },
};

interface Props { chain: string; address: string }

/** ¿Quién está detrás de este token? Se carga aparte para no frenar la página (consulta a X). */
export function TeamCard({ chain, address }: Props) {
  const [report, setReport] = useState<TeamReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setFailed(false);
    fetch(`/api/token/${encodeURIComponent(address)}/team?chain=${encodeURIComponent(chain)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: TeamReport) => { if (!cancelled) setReport(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [chain, address]);

  if (failed) return <p className="text-sm text-muted">No pudimos armar el informe del equipo ahora. Intenta recargar en un momento.</p>;
  if (!report) return <div className="h-32 animate-pulse rounded-xl border border-line bg-panel" role="status" aria-label="Buscando quién está detrás del token" />;

  const v = VERDICT[report.verdict];
  const VIcon = v.Icon;
  const x = report.x;

  return (
    <div className="space-y-4">
      <div className={cn('flex gap-3 rounded-xl border p-3', v.cls)}>
        <VIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">{report.title}</p>
          <p className="text-sm opacity-90">{report.summary}</p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-3">
          <dt className="text-xs text-muted">Cuenta de X</dt>
          <dd className="mt-0.5">
            {x ? (
              <>
                <a href={`https://x.com/${x.handle}`} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-brand">@{x.handle}</a>
                {x.found && <span className="text-muted"> · {x.followers?.toLocaleString('en-US') ?? '?'} seguidores{x.ageDays !== null ? ` · ${x.ageDays} días` : ''}</span>}
                {x.found === false && <span className="text-rose-300"> · no existe</span>}
                {x.found === null && <span className="text-muted"> · sin verificar</span>}
                {x.bio && <p className="mt-1 line-clamp-2 text-xs text-muted">{x.bio}</p>}
              </>
            ) : <span className="text-rose-300">No registrada</span>}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <dt className="text-xs text-muted">¿La cuenta publicó este contrato?</dt>
          <dd className="mt-0.5 font-medium">
            {x?.mentionsContract === true && <span className="text-emerald-300">Sí</span>}
            {x?.mentionsContract === false && <span className="text-amber-300">No lo encontramos</span>}
            {(!x || x.mentionsContract === null) && <span className="text-muted">Sin datos</span>}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <dt className="text-xs text-muted">Sitio web</dt>
          <dd className="mt-0.5 break-all">
            {report.website ? <a href={report.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-brand">{report.website}</a> : <span className="text-amber-300">No registrado</span>}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <dt className="text-xs text-muted">Wallet creadora</dt>
          <dd className="mt-0.5">
            {report.creator ? (
              <>
                <a href={explorerUrl(chain, report.creator.address) ?? '#'} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-brand">{shortAddress(report.creator.address, 5)}</a>
                {report.creator.holdingPct !== null && <span className="text-muted"> · tiene {report.creator.holdingPct.toFixed(1)}%</span>}
              </>
            ) : <span className="text-muted">No disponible en esta red</span>}
          </dd>
        </div>
      </dl>

      <ul className="space-y-2">
        {report.notes.map((n) => {
          const { Icon, cls } = NOTE[n.tone];
          return (
            <li key={n.text} className="flex gap-2 text-sm">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls)} aria-hidden />
              <span>{n.text}</span>
            </li>
          );
        })}
      </ul>

      {report.lookalikes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tokens con el mismo nombre o símbolo</h3>
          {report.thisRank && (
            <p className="text-xs text-muted">
              Este token es el #{report.thisRank.byLiquidity} de {report.thisRank.total} por liquidez y el #{report.thisRank.byAge} por antigüedad (1 = el de más liquidez o el más viejo).
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-panel text-left text-muted">
                <tr>
                  <th className="p-2 font-medium">Token</th>
                  <th className="p-2 font-medium">Red</th>
                  <th className="p-2 text-right font-medium">Liquidez</th>
                  <th className="p-2 text-right font-medium">Edad</th>
                  <th className="p-2 font-medium">Redes</th>
                </tr>
              </thead>
              <tbody>
                {report.lookalikes.map((l) => (
                  <tr key={`${l.chain}:${l.address}`} className="border-t border-line">
                    <td className="p-2">
                      <Link href={`/token/${l.address}?chain=${l.chain}`} className="hover:text-brand">
                        <span className="font-medium">{l.symbol}</span> <span className="text-muted">{l.name}</span>
                      </Link>
                    </td>
                    <td className="p-2 text-muted">{chainLabel(l.chain)}</td>
                    <td className="p-2 text-right">{formatUsd(l.liquidityUsd)}</td>
                    <td className="p-2 text-right text-muted">{l.ageDays !== null ? `${l.ageDays} d` : '—'}</td>
                    <td className="p-2">{l.hasSocials ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Veltrix no puede confirmar quién es una persona: reúne señales públicas (cuenta de X, enlace entre perfil y sitio, si publicó este contrato, wallet del creador y tokens parecidos). Un equipo visible no garantiza que el token sea seguro, y un equipo anónimo no prueba que sea una estafa.
      </p>
    </div>
  );
}
