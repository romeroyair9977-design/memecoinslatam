import { NextResponse } from 'next/server';
import { getXTrends } from '@/lib/services/xtrends';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

/** GET /api/x-trends?hours=1|6|24 */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const h = Number(new URL(req.url).searchParams.get('hours') ?? 24);
  const hours = h === 1 || h === 6 ? h : 24;
  try {
    const fresh = new URL(req.url).searchParams.get('fresh') === '1';
    const result = await getXTrends(hours, fresh);
    return NextResponse.json(result, { headers: { 'Cache-Control': fresh ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
