'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Mail, Wallet } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Web3Chain = 'solana' | 'ethereum';
// signInWithWeb3 existe desde supabase-js 2.58 (Sign in with Solana / Ethereum, EIP-4361). Hay que activarlo en
// Authentication → Providers → Web3 Wallet.
type Web3Auth = { signInWithWeb3(a: { chain: Web3Chain; statement: string }): Promise<{ error: { message: string } | null }> };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'enlace' | 'clave'>('enlace');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sb = getBrowserSupabase();

  if (!sb) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        Modo demo: configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para activar las cuentas.
      </p>
    );
  }

  async function emailLogin(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy('email'); setError(null);
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(null);
    if (err) setError('No pudimos enviar el correo. Revisa la dirección e intenta otra vez.');
    else setSent(true);
  }

  /** Correo + contraseña: entrar o crear cuenta. Si la confirmación por correo está activa, signUp no devuelve sesión. */
  async function passwordAuth(kind: 'entrar' | 'crear') {
    if (!sb) return;
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setBusy(kind); setError(null);
    if (kind === 'entrar') {
      const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(null);
      if (err) return setError('Correo o contraseña incorrectos.');
      router.push(next); router.refresh();
      return;
    }
    const { data, error: err } = await sb.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(null);
    if (err) return setError(err.message.toLowerCase().includes('registered') ? 'Ese correo ya tiene cuenta. Prueba con "Entrar".' : 'No pudimos crear la cuenta. Revisa los datos e intenta otra vez.');
    if (data.session) { router.push(next); router.refresh(); } else setSent(true);
  }

  async function walletLogin(chain: Web3Chain) {
    if (!sb) return;
    setBusy(chain); setError(null);
    const provider = chain === 'solana' ? (window as unknown as { solana?: unknown }).solana : (window as unknown as { ethereum?: unknown }).ethereum;
    if (!provider) {
      setBusy(null);
      setError(chain === 'solana' ? 'No detectamos Phantom u otra wallet de Solana en este navegador.' : 'No detectamos MetaMask u otra wallet EVM en este navegador.');
      return;
    }
    const { error: err } = await (sb.auth as unknown as Web3Auth).signInWithWeb3({
      chain,
      statement: 'Inicia sesión en MemeLatam. Firmar no cuesta gas ni da acceso a tus fondos.',
    });
    setBusy(null);
    if (err) { setError(`No se pudo iniciar con la wallet: ${err.message}`); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button onClick={() => walletLogin('solana')} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">
          <Wallet className="h-4 w-4" aria-hidden /> {busy === 'solana' ? 'Esperando firma…' : 'Entrar con wallet de Solana'}
        </button>
        <button onClick={() => walletLogin('ethereum')} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-medium hover:border-brand/60 disabled:opacity-60">
          <Wallet className="h-4 w-4" aria-hidden /> {busy === 'ethereum' ? 'Esperando firma…' : 'Entrar con wallet EVM (Base, ETH, BNB…)'}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con correo<span className="h-px flex-1 bg-line" /></div>

      {sent ? (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Te enviamos un correo a <strong>{email}</strong>. Ábrelo en este navegador para continuar.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 text-sm" role="tablist" aria-label="Método de acceso con correo">
            {([['enlace', 'Enlace mágico'], ['clave', 'Contraseña']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-full border px-3 py-1 ${mode === id ? 'border-brand/60 bg-panel2' : 'border-line text-muted'}`}>{label}</button>
            ))}
          </div>
          <form onSubmit={mode === 'enlace' ? emailLogin : (e) => { e.preventDefault(); void passwordAuth('entrar'); }} className="space-y-2">
            <label htmlFor="email" className="text-sm text-muted">Correo electrónico</label>
            <div className="flex gap-2">
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" className="h-11 flex-1 rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted" />
              {mode === 'enlace' && (
                <button type="submit" disabled={!!busy} className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm hover:border-brand/60 disabled:opacity-60">
                  <Mail className="h-4 w-4" aria-hidden /> Enviar enlace
                </button>
              )}
            </div>
            {mode === 'clave' && (
              <>
                <label htmlFor="password" className="text-sm text-muted">Contraseña (mínimo 8 caracteres)</label>
                <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm" />
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={!!busy} className="h-11 flex-1 rounded-lg bg-brand text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">{busy === 'entrar' ? 'Entrando…' : 'Entrar'}</button>
                  <button type="button" onClick={() => void passwordAuth('crear')} disabled={!!busy || !email} className="h-11 flex-1 rounded-lg border border-line text-sm hover:border-brand/60 disabled:opacity-60">{busy === 'crear' ? 'Creando…' : 'Crear cuenta'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
