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
          Te enviamos un enlace a <strong>{email}</strong>. Ábrelo en este navegador para entrar.
        </p>
      ) : (
        <form onSubmit={emailLogin} className="space-y-2">
          <label htmlFor="email" className="text-sm text-muted">Correo electrónico</label>
          <div className="flex gap-2">
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" className="h-11 flex-1 rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted" />
            <button type="submit" disabled={!!busy} className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm hover:border-brand/60 disabled:opacity-60">
              <Mail className="h-4 w-4" aria-hidden /> Enviar enlace
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
