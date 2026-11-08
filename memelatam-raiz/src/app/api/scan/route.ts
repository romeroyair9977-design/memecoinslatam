import { NextResponse } from 'next/server';
import { getScanBoard } from '@/lib/services/scan';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getScanBoard(), { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
