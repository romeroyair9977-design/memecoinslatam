import { NextResponse } from 'next/server';
import { detectAddressKind } from '@/lib/addresses';
import { getTeamReport } from '@/lib/services/team';
import { getTokenFull } from '@/lib/services/token';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** GET /api/token/<address>/team?chain=solana → informe "¿Quién está detrás?" */
export async function GET(req: Request, { params }: { params: { address: string } }) {
  const address = decodeURIComponent(params.address);
  if (!detectAddressKind(address)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const chain = new URL(req.url).searchParams.get('chain') ?? undefined;
  try {
    const res = await getTokenFull(address, chain);
    if (res.status !== 'ok') return NextResponse.json({ error: res.status }, { status: res.status === 'not_found' ? 404 : 502 });
    return NextResponse.json(await getTeamReport(res.token), { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
