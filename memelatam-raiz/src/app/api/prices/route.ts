import { NextResponse } from 'next/server';
import { detectAddressKind } from '@/lib/addresses';
import { isSupportedChain } from '@/lib/chains';
import { getLivePrices } from '@/lib/services/live';

export const dynamic = 'force-dynamic';

/** GET /api/prices?t=solana:ADDR,base:ADDR… (máx. 90). Precios y números en vivo para las cards del dashboard. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('t') ?? '';
  const refs = raw
    .split(',')
    .slice(0, 90)
    .map((s) => {
      const i = s.indexOf(':');
      return { chain: s.slice(0, i), address: s.slice(i + 1) };
    })
    .filter((r) => isSupportedChain(r.chain) && detectAddressKind(r.address));
  if (!refs.length) return NextResponse.json({});

  try {
    const data = await getLivePrices(refs);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=6' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
