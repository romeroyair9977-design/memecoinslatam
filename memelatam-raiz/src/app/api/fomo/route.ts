import { NextResponse } from 'next/server';
import { getFomoBoard } from '@/lib/services/fomo';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

export async function GET() {
  try {
    return NextResponse.json(await getFomoBoard(), { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
