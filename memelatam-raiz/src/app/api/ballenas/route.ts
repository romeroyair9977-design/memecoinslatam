import { NextResponse } from 'next/server';
import { getWhaleBoard } from '@/lib/services/whales';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

export async function GET() {
  try {
    return NextResponse.json(await getWhaleBoard(), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
