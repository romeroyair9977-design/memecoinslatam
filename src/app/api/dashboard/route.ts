import { NextResponse } from 'next/server';
import { getDashboard } from '@/lib/services/dashboard';

// Siempre dinámico: el navegador lo consulta cada ~20 s. La protección contra abuso es el cache:
// 1 cálculo cada 20 s por instancia (y se sirve el dato anterior al instante mientras se recalcula) (lib/cache.ts) + cache de CDN (s-maxage).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboard();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ error: 'dashboard_unavailable' }, { status: 502 });
  }
}
