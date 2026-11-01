import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { getMe } from '@/lib/auth';
import { safeNext } from '@/lib/redirect';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getMe()) redirect(next);

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-bold">Entra a la comunidad</h1>
        <p className="text-sm text-muted">Necesitas una cuenta para escribir, reaccionar y publicar tesis. Leer es libre.</p>
      </header>
      {searchParams.error && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">El enlace expiró o ya se usó. Pide uno nuevo.</p>
      )}
      <LoginForm next={next} />
      <p className="text-center text-xs text-muted">Al entrar aceptas no usar la plataforma para estafar a otros. Esto no es asesoría financiera.</p>
    </div>
  );
}
