/**
 * RugCheck (Solana). API pública sin key para reportes: https://api.rugcheck.xyz/swagger
 * Aporta: top holders con wallet, insiders, autoridades de mint/freeze y flag de rug.
 *
 * ⚠️ Los "top holders" suelen incluir la cuenta del pool/LP y la bonding curve, lo que infla la
 * concentración. TODO (iteración holders): excluir direcciones de `markets[].liquidityA/B` y de AMMs conocidos.
 */
import { cached } from '../cache';
import { TTL } from '../config';
import { fetchJson } from '../http';
import type { HolderStats, SecuritySignals } from '@/types/token';

interface RawReport {
  rugged?: boolean;
  totalHolders?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  topHolders?: { address: string; amount?: number; pct: number; insider?: boolean }[];
  risks?: { name: string; description?: string; level?: string }[];
}

export interface RugCheckOverview {
  holders: HolderStats;
  security: SecuritySignals;
}

export async function getRugCheckOverview(mint: string): Promise<RugCheckOverview | null> {
  return cached(`rugcheck:${mint}`, TTL.holders, async () => {
    try {
      const r = await fetchJson<RawReport>(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
        revalidate: 300,
        timeoutMs: 10_000,
      });
      const holders = (r.topHolders ?? []).map((h) => ({
        address: h.address,
        pct: h.pct, // RugCheck devuelve porcentaje (p.ej. 12.3 = 12.3%)
        amount: h.amount,
        isInsider: h.insider,
      }));
      const top10Pct = holders.slice(0, 10).reduce((sum, h) => sum + h.pct, 0);

      return {
        holders: {
          source: 'rugcheck' as const,
          totalHolders: r.totalHolders ?? null,
          top10Pct: holders.length ? top10Pct : null,
          top1Pct: holders[0]?.pct ?? null,
          holders: holders.slice(0, 20),
        },
        security: {
          rugged: Boolean(r.rugged),
          mintAuthorityActive: Boolean(r.mintAuthority),
          freezeAuthorityActive: Boolean(r.freezeAuthority),
          dangerRisks: (r.risks ?? [])
            .filter((x) => x.level === 'danger')
            .map((x) => x.description ?? x.name),
        },
      };
    } catch {
      return null;
    }
  });
}
