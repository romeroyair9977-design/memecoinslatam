import { NextResponse } from 'next/server';
import { isSupportedChain } from '@/lib/chains';
import { getChartData, isTimeframe } from '@/lib/services/chart';

export const dynamic = 'force-dynamic';

// Direcciones de pool/token: letras y números (EVM 0x…, hash de 66 chars en Uniswap v4, base58 en Solana).
const ADDR = /^[A-Za-z0-9]{20,100}$/;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '';
  const pool = q.get('pool') ?? '';
  const token = q.get('token') ?? '';
  const tf = q.get('tf') ?? '15m';
  if (!isSupportedChain(chain) || !ADDR.test(pool) || !ADDR.test(token) || !isTimeframe(tf)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  try {
    const data = await getChartData(chain, pool, token, tf);
    if (!data) return NextResponse.json({ error: 'no_data' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
