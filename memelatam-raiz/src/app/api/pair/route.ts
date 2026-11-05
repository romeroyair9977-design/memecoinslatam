import { NextResponse } from 'next/server';
import { isSupportedChain } from '@/lib/chains';
import { getLivePair } from '@/lib/services/dexscreener';

export const dynamic = 'force-dynamic';
const ADDR = /^[A-Za-z0-9]{20,100}$/;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '';
  const token = q.get('token') ?? '';
  const pool = q.get('pool') ?? '';
  if (!isSupportedChain(chain) || !ADDR.test(token) || !ADDR.test(pool)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const pair = await getLivePair(chain, token, pool);
    if (!pair) return NextResponse.json({ error: 'no_data' }, { status: 404 });
    return NextResponse.json(pair, { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
