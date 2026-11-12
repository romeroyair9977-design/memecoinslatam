import 'server-only';
import { cacheSafeAddress } from '../addresses';
import { createPublicSupabase } from '../supabase/server';
import type { PotentialCall } from '@/types/market';
import { toCall } from './potencial-map';

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
