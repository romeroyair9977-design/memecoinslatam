import { NextResponse } from 'next/server';
import { detectAddressKind } from '@/lib/addresses';
import { getLiveMarket } from '@/lib/services/live';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { address: string } }) {
  const address = decodeURIComponent(params.address);
  if (!detectAddressKind(address)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const chain = new URL(req.url).searchParams.get('chain') ?? undefined;
  try {
    const market = await getLiveMarket(address, chain);
    if (!market) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(market, { headers: { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
