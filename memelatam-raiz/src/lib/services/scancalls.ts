import 'server-only';
import { createPublicSupabase } from '../supabase/server';
import type { CallRow, Tier } from '../potencial';

interface RawCall {
  id: number; chain: string; address: string; symbol: string; name: string; image_url: string | null;
  target_x: number; entry_price: number | string; entry_mcap: number | string; peak_price: number | string; last_price: number | string;
  status: 'open' | 'hit' | 'miss'; called_at: string; expires_at: string; resolved_at: string | null; reasons: string[] | null;
}

const COLS = 'id, chain, address, symbol, name, image_url, target_x, entry_price, entry_mcap, peak_price, last_price, status, called_at, expires_at, resolved_at, reasons';

/** Historial público del radar (todas las llamadas, aciertos y fallos). Si Supabase no está listo devuelve []. */
export async function getScanCalls(limit = 300): Promise<CallRow[]> {
  const sb = createPublicSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('scan_calls').select(COLS).order('called_at', { ascending: false }).limit(limit);
  if (error) return [];
  return ((data ?? []) as RawCall[]).map((r) => ({
    id: r.id,
    chain: r.chain,
    address: r.address,
    symbol: r.symbol,
    name: r.name,
    imageUrl: r.image_url,
    target: r.target_x as Tier,
    entryPrice: Number(r.entry_price),
    entryMcap: Number(r.entry_mcap),
    peakPrice: Number(r.peak_price),
    lastPrice: Number(r.last_price),
    status: r.status,
    calledAt: Date.parse(r.called_at),
    expiresAt: Date.parse(r.expires_at),
    resolvedAt: r.resolved_at ? Date.parse(r.resolved_at) : null,
    reasons: r.reasons ?? [],
  }));
}
