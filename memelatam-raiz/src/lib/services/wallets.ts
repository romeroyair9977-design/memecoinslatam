import 'server-only';
import { cached } from '../cache';
import { getDashboard } from './dashboard';
import { getRugCheckOverview } from './rugcheck';

export interface ActiveWallet {
  address: string;
  chain: 'solana';
  /** En cuántas memecoins calientes aparece entre los mayores holders */
  tokens: { symbol: string; address: string; pct: number }[];
  totalPct: number;
  insider: boolean;
}

const MAX_TOKENS = 30;
const BUDGET_MS = 7_000;

/**
 * "Ballenas en movimiento": wallets de Solana que aparecen entre los mayores holders de VARIAS de las memecoins más
 * activas del momento (se excluyen pools/LP). Es una señal de interés, NO de rentabilidad: no hay PnL verificado.
 * Usa los mismos tokens que el dashboard ya consultó en RugCheck, así casi todo sale del cache (5 min).
 */
export function getActiveWallets(): Promise<ActiveWallet[]> {
  return cached('wallets:active', 10 * 60_000, async () => {
    const dash = await getDashboard();
    const targets = dash.tokens
      .filter((t) => t.chain === 'solana' && t.liquidityUsd >= 10_000)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, MAX_TOKENS);

    const by = new Map<string, ActiveWallet>();
    let i = 0;
    const worker = async () => {
      while (i < targets.length) {
        const t = targets[i++];
        const o = await getRugCheckOverview(t.address).catch(() => null);
        for (const h of o?.holders.holders ?? []) {
          if (h.pct < 0.5) continue; // polvo
          const w = by.get(h.address) ?? { address: h.address, chain: 'solana' as const, tokens: [], totalPct: 0, insider: false };
          w.tokens.push({ symbol: t.symbol, address: t.address, pct: h.pct });
          w.totalPct += h.pct;
          w.insider ||= Boolean(h.isInsider);
          by.set(h.address, w);
        }
      }
    };
    await Promise.race([Promise.all(Array.from({ length: 8 }, worker)), new Promise((r) => setTimeout(r, BUDGET_MS))]);
    return [...by.values()].filter((w) => w.tokens.length >= 2).sort((a, b) => b.tokens.length - a.tokens.length || b.totalPct - a.totalPct).slice(0, 30);
  });
}
