import 'server-only';
import { cached, withTimeout } from '../cache';
import { createPublicSupabase, createServerSupabase } from '../supabase/server';
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

const MAX_TOKENS = 28;
const BUDGET_MS = 9_000;

/**
 * "Wallets en movimiento": wallets de Solana que aparecen entre los mayores holders de VARIAS de las memecoins más
 * calientes del momento (se excluyen pools/LP). Es una señal de interés, NO de rentabilidad: no tenemos PnL
 * verificado, así que no lo mostramos. Reutiliza el cache de RugCheck (5 min).
 */
export function getActiveWallets(): Promise<ActiveWallet[]> {
  return cached('wallets:active', 5 * 60_000, async () => {
    const dash = await getDashboard();
    const targets = dash.tokens
      .filter((t) => t.chain === 'solana' && t.liquidityUsd >= 15_000)
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, MAX_TOKENS);

    const by = new Map<string, ActiveWallet>();
    let i = 0;
    const worker = async () => {
      while (i < targets.length) {
        const t = targets[i++];
        const o = await withTimeout(getRugCheckOverview(t.address), 8_000, null);
        for (const h of o?.holders.holders ?? []) {
          if (h.pct < 0.3) continue; // polvo
          const w = by.get(h.address) ?? { address: h.address, chain: 'solana' as const, tokens: [], totalPct: 0, insider: false };
          w.tokens.push({ symbol: t.symbol, address: t.address, pct: h.pct });
          w.totalPct += h.pct;
          w.insider ||= Boolean(h.isInsider);
          by.set(h.address, w);
        }
      }
    };
    await Promise.race([Promise.all(Array.from({ length: 6 }, worker)), new Promise((r) => setTimeout(r, BUDGET_MS))]);
    return [...by.values()].filter((w) => w.tokens.length >= 2).sort((a, b) => b.tokens.length - a.tokens.length || b.totalPct - a.totalPct).slice(0, 30);
  }, 30 * 60_000);
}

export interface PopularWallet { chain: string; address: string; savers: number }

/** Wallets que más personas guardaron (solo el conteo; nunca quién ni con qué etiqueta). */
export async function getPopularWallets(limit = 20): Promise<PopularWallet[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('popular_wallets').select('chain, address, savers').order('savers', { ascending: false }).limit(limit);
  return (data ?? []) as PopularWallet[];
}

/** Todas las wallets guardadas por el usuario (para marcar "Guardada" y para el gestor). */
export async function getMyWallets(userId: string) {
  const sb = createServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('wallet_follows').select('chain, address, label').eq('user_id', userId).order('created_at', { ascending: false });
  return (data ?? []) as { chain: string; address: string; label: string | null }[];
}
