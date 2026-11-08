/**
 * RugCheck (Solana). API pública sin key para reportes: https://api.rugcheck.xyz/swagger
 * Aporta: top holders con wallet, insiders, autoridades de mint/freeze y flag de rug.
 *
 * Los "top holders" suelen incluir la cuenta del pool/LP, lo que infla la concentración: se excluyen las
 * cuentas de `markets[]` (pubkey/liquidityA/liquidityB). Si RugCheck cambia el esquema, revisa este filtro.
 * Pendiente: bonding curve de pump.fun y AMMs no listados en `markets`.
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
  creator?: string | null;
  topHolders?: { address: string; owner?: string; amount?: number; pct: number; insider?: boolean }[];
  /** Pools del token: sus cuentas (vaults/LP) NO son holders reales y inflan la concentración. */
  markets?: { pubkey?: string; liquidityA?: string; liquidityB?: string; lp?: { lpLockedPct?: number } & Record<string, unknown> }[];
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
      // Excluye cuentas de pools/AMM (vaults de liquidez) para no inflar el top 10.
      const poolAccounts = new Set(
        (r.markets ?? []).flatMap((m) => [m.pubkey, m.liquidityA, m.liquidityB]).filter((x): x is string => !!x),
      );
      const holders = (r.topHolders ?? [])
        .filter((h) => !poolAccounts.has(h.address) && !(h.owner && poolAccounts.has(h.owner)))
        .map((h) => ({
        address: h.address,
        pct: h.pct, // RugCheck devuelve porcentaje (p.ej. 12.3 = 12.3%)
        amount: h.amount,
        isInsider: h.insider,
        owner: h.owner,
      }));
      const creatorHolding = r.creator ? holders.find((h) => h.owner === r.creator || h.address === r.creator) : undefined;
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
          creator: r.creator ?? null,
          creatorHoldingPct: creatorHolding ? creatorHolding.pct : null,
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
