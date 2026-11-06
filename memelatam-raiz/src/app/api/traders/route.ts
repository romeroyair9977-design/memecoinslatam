import { NextResponse } from 'next/server';
import { isSupportedChain } from '@/lib/chains';
import { getTopTraders } from '@/lib/services/chart';

export const dynamic = 'force-dynamic';
const POOL_RE = /^[A-Za-z0-9]{20,70}$/;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '';
  const pair = q.get('pair') ?? '';
  if (!isSupportedChain(chain) || !POOL_RE.test(pair)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const traders = await getTopTraders(chain, pair);
    return NextResponse.json({ traders }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
