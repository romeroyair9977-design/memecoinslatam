import { NextResponse } from 'next/server';
import { isSupportedChain } from '@/lib/chains';
import { detectAddressKind } from '@/lib/addresses';
import { getCandles, isTimeframe } from '@/lib/services/chart';

export const dynamic = 'force-dynamic';
const POOL_RE = /^[A-Za-z0-9]{20,70}$/;

/** GET /api/chart?chain=&pair=&token=&tf=1m&limit=200 → { candles } (ascendente por tiempo). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '';
  const pair = q.get('pair') ?? '';
  const token = q.get('token') ?? '';
  const tf = q.get('tf') ?? '1m';
  const limit = Math.min(500, Math.max(1, Number(q.get('limit') ?? 200) || 200));
  if (!isSupportedChain(chain) || !POOL_RE.test(pair) || !detectAddressKind(token) || !isTimeframe(tf))
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const candles = await getCandles(chain, pair, token, tf, limit);
    return NextResponse.json({ candles }, { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=8' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
