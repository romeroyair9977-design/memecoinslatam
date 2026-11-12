import { NextResponse } from 'next/server';
import { detectAddressKind } from '@/lib/addresses';
import { isSupportedChain } from '@/lib/chains';
import { getLevelData } from '@/lib/services/levels';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;
const POOL_RE = /^[A-Za-z0-9]{20,70}$/;

/** GET /api/token/<address>/levels?chain=solana&pair=<pool> → { data: LevelData | null } */
export async function GET(req: Request, { params }: { params: { address: string } }) {
  const address = decodeURIComponent(params.address);
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '';
  const pair = q.get('pair') ?? '';
  if (!detectAddressKind(address) || !isSupportedChain(chain) || !POOL_RE.test(pair)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const data = await getLevelData(chain, pair, address);
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
