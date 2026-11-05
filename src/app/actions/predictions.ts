'use server';

import { revalidatePath } from 'next/cache';
import { detectAddressKind } from '@/lib/addresses';
import { isSupportedChain } from '@/lib/chains';
import { CATEGORIES, HORIZONS, MIN_LIQUIDITY_TO_PREDICT, type Side } from '@/lib/predictions';
import { getTokenFull } from '@/lib/services/token';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { tokenKey } from '@/types/community';

export type PredictResult = { ok: true; symbol: string; dueAt: string } | { ok: false; error: string; needsLogin?: boolean };

/**
 * Registra una predicción de permanencia. El servidor valida el token contra DexScreener y toma la liquidez de
 * entrada de ahí (el cliente no puede falsearla); la inserción pasa por la RPC `create_prediction` (service_role).
 */
export async function createPrediction(chain: string, address: string, side: Side, days: number, category: string): Promise<PredictResult> {
  if (!isSupportedChain(chain) || !detectAddressKind(address)) return { ok: false, error: 'Token o red no válidos.' };
  if (side !== 'vive' && side !== 'muere') return { ok: false, error: 'Elige si vive o muere.' };
  if (!HORIZONS.some((h) => h.days === days)) return { ok: false, error: 'Plazo no válido.' };
  if (!CATEGORIES.some((c) => c.id === category)) return { ok: false, error: 'Categoría no válida.' };

  const sb = createServerSupabase();
  if (!sb) return { ok: false, error: 'Supabase no está configurado (modo demo).' };
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { ok: false, error: 'Inicia sesión para predecir.', needsLogin: true };

  const res = await getTokenFull(address, chain);
  if (res.status !== 'ok') return { ok: false, error: 'No pudimos verificar este token. Revisa la dirección o intenta en un momento.' };
  const t = res.token;
  if (t.pair.liquidityUsd < MIN_LIQUIDITY_TO_PREDICT) {
    return { ok: false, error: `Solo se puede predecir sobre tokens con al menos $${MIN_LIQUIDITY_TO_PREDICT.toLocaleString('en-US')} de liquidez.` };
  }
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: 'El servidor no tiene configurada SUPABASE_SERVICE_ROLE_KEY.' };

  const { error: upErr } = await admin.rpc('upsert_token', { p_chain: t.chain, p_address: t.address, p_symbol: t.symbol, p_name: t.name, p_image: t.imageUrl });
  if (upErr) return { ok: false, error: 'No se pudo registrar el token.' };

  const { error } = await admin.rpc('create_prediction', {
    p_user: u.user.id, p_token_key: tokenKey(t.chain, t.address), p_side: side, p_days: days, p_category: category,
    p_liquidity: t.pair.liquidityUsd, p_price: t.pair.priceUsd,
  });
  if (error) return { ok: false, error: error.message.includes('P0001') || error.code === 'P0001' ? error.message : 'No se pudo guardar la predicción.' };

  revalidatePath('/predicciones');
  return { ok: true, symbol: t.symbol, dueAt: new Date(Date.now() + days * 86_400_000).toISOString() };
}
