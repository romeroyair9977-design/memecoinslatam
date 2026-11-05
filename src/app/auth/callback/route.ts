import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/redirect';
import { createServerSupabase } from '@/lib/supabase/server';

/** Destino del link mágico del email: intercambia el `code` por una sesión y redirige. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  if (code) {
    const sb = createServerSupabase();
    const { error } = (await sb?.auth.exchangeCodeForSession(code)) ?? { error: new Error('sin supabase') };
    if (error) return NextResponse.redirect(`${origin}/login?error=link`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
