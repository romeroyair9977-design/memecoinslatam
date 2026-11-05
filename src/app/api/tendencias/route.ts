import { NextResponse } from 'next/server';
import { getTrends, isTrendWindow } from '@/lib/services/social';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const w = new URL(req.url).searchParams.get('window') ?? '6h';
  if (!isTrendWindow(w)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    return NextResponse.json(await getTrends(w), { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
