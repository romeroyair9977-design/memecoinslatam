import 'server-only';
import { cacheSafeAddress } from '../addresses';
import { createPublicSupabase } from '../supabase/server';
import type { PotentialCall } from '@/types/market';

/** Las columnas numeric de Postgres pueden llegar como texto: se convierten una sola vez aquí. */
export function toCall(r: Record<string, unknown>): PotentialCall {
  return {
    id: String(r.id),
    chain: String(r.chain),
    address: String(r.address),
    symbol: String(r.symbol),
    name: String(r.name),
    image: (r.image as string | null) ?? null,
    multiple: Number(r.multiple) as PotentialCall['multiple'],
    entry_price: Number(r.entry_price),
    entry_mc: Number(r.entry_mc),
    target_mc: Number(r.target_mc),
    score: Number(r.score),
    reasons: (r.reasons as string[] | null) ?? [],
    created_at: String(r.created_at),
    expires_at: String(r.expires_at),
    status: r.status as PotentialCall['status'],
    peak_multiple: Number(r.peak_multiple),
    resolved_at: (r.resolved_at as string | null) ?? null,
    hit_at: (r.hit_at as string | null) ?? null,
  };
}

export async function getCalls(): Promise<PotentialCall[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('veltrix_calls').select('*').order('created_at', { ascending: false }).limit(300);
  return ((data ?? []) as Record<string, unknown>[]).map(toCall);
}

export async function getCallsForToken(chain: string, address: string): Promise<PotentialCall[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data } = await sb.from('veltrix_calls').select('*').eq('token_key', `${chain}:${cacheSafeAddress(address)}`).order('created_at', { ascending: false }).limit(6);
  return ((data ?? []) as Record<string, unknown>[]).map(toCall);
}
