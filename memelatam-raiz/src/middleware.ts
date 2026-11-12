import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refresca la sesión de Supabase en cada request (patrón oficial de @supabase/ssr). */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  // Visitantes sin sesión (la mayoría): no hay nada que refrescar → cero llamadas a Supabase y respuesta inmediata.
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Todo menos estáticos e imágenes. La home (ISR) y el token no necesitan sesión, pero es barato.
  // Se excluyen las APIs de datos (se consultan cada pocos segundos y no usan sesión) y ads.txt.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ads.txt|api/prices|api/chart|api/traders|api/dashboard|api/token|api/cron|api/x-trends|api/fomo|api/jobs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
