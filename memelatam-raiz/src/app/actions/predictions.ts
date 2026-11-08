'use server';

import { revalidatePath } from 'next/cache';
import { detectAddressKind } from '@/lib/addresses';
import { isSupportedChain } from '@/lib/chains';
import { HORIZONS, type Side } from '@/lib/predictions';
import { getTokenFull } from '@/lib/services/token';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { tokenKey } from '@/types/community';
import type { ActionResult } from './community';

/**
 * Registra una predicción de permanencia. El servidor (no el navegador) consulta la liquidez real del token en
 * DexScreener y llama a la RPC con service_role: así nadie puede falsear la liquidez inicial para ganar fácil.
 * El cobro de los $LATAM y la validación de balance los hace Postgres (`place_prediction` → `spend_points`).
 */
export async function placePrediction(chain: string, address: string, days: number, side: Side): Promise<ActionResult> {
  if (!(HORIZONS as readonly number[]).includes(days) || !['vive', 'muere'].includes(side)) return { ok: false, error: 'Predicción no válida.' };
  if (!isSupportedChain(chain) || !detectAddressKind(address)) return { ok: false, error: 'Token o red no válidos.' };

  const sb = createServerSupabase();
  if (!sb) return { ok: false, error: 'Supabase no está configurado (modo demo).' };
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: 'Inicia sesión para predecir.', needsLogin: true };

  const res = await getTokenFull(address, chain);
  if (res.status !== 'ok') return { ok: false, error: 'No pudimos verificar este token. Intenta de nuevo en un momento.' };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: 'El servidor no tiene configurada SUPABASE_SERVICE_ROLE_KEY.' };
  const t = res.token;

  const { error: upErr } = await admin.rpc('upsert_token', {
    p_chain: t.chain, p_address: t.address, p_symbol: t.symbol, p_name: t.name, p_image: t.imageUrl,
  });
  if (upErr) return { ok: false, error: 'No se pudo registrar el token.' };

  const { error } = await admin.rpc('place_prediction', {
    p_user_id: data.user.id,
    p_token_key: tokenKey(t.chain, t.address),
    p_days: days,
    p_side: side,
    p_liquidity: t.pair.liquidityUsd,
  });
  if (error) return { ok: false, error: error.code === 'P0001' ? error.message : 'No se pudo registrar tu predicción.' };

  revalidatePath(`/token/${t.address}`);
  revalidatePath('/predictores');
  return { ok: true };
}
