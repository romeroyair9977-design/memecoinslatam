'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { KeyRound, Mail, Wallet } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Web3Chain = 'solana' | 'ethereum';
// signInWithWeb3 existe desde supabase-js 2.58 (Sign in with Solana / Ethereum, EIP-4361). Hay que activarlo en
// Authentication → Providers → Web3 Wallet.
type Web3Auth = { signInWithWeb3(a: { chain: Web3Chain; statement: string }): Promise<{ error: { message: string } | null }> };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // codigo = correo → te llega un código → lo escribes aquí (sin contraseña). clave = correo + contraseña.
  const [mode, setMode] = useState<'codigo' | 'clave'>('codigo');
  const [codeSent, setCodeSent] = useState(false);
  const [confirmMail, setConfirmMail] = useState(false); // solo para "crear cuenta" con confirmación de correo activa
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

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  /** Entrar con Google (OAuth). Requiere activar Google en Authentication → Providers (ver README). */
  async function googleLogin() {
    if (!sb) return;
    setBusy('google'); setError(null);
    const { error: err } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (err) {
      setBusy(null);
      setError('No pudimos abrir Google. Si eres el administrador: activa el proveedor Google en Supabase (Authentication → Providers).');
    } // si todo va bien, el navegador se va a Google y no hay que hacer nada más
  }

  /** Paso 1: pide el código. Supabase lo manda al correo (crea la cuenta si no existe). */
  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!sb) return;
    setBusy('email'); setError(null);
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: callback() },
    });
    setBusy(null);
    if (err) {
      setError(err.status === 429 || /rate|seconds|limit/i.test(err.message)
        ? 'Pediste demasiados códigos seguidos. Espera un minuto e intenta otra vez.'
        : 'No pudimos enviar el código. Revisa la dirección e intenta otra vez.');
    } else {
      setCodeSent(true); setCode('');
    }
  }

  /** Paso 2: confirma el código y abre la sesión. */
  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) return setError('El código son solo números (6 a 10 dígitos).');
    setBusy('verify'); setError(null);
    const { error: err } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(null);
    if (err) return setError('Código incorrecto o vencido. Pide uno nuevo.');
    router.push(next); router.refresh();
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
    const { data, error: err } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback() } });
    setBusy(null);
    if (err) return setError(err.message.toLowerCase().includes('registered') ? 'Ese correo ya tiene cuenta. Prueba con "Entrar".' : 'No pudimos crear la cuenta. Revisa los datos e intenta otra vez.');
    if (data.session) { router.push(next); router.refresh(); } else setConfirmMail(true);
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
      statement: 'Inicia sesión en Veltrix Coin. Firmar no cuesta gas ni da acceso a tus fondos.',
    });
    setBusy(null);
    if (err) { setError(`No se pudo iniciar con la wallet: ${err.message}`); return; }
    router.push(next);
    router.refresh();
  }

  const inputCls = 'h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted';

  return (
    <div className="space-y-6">
      <button onClick={googleLogin} disabled={!!busy} className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60">
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {busy === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>

      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>

      {confirmMail ? (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Cuenta creada. Te enviamos un correo a <strong>{email}</strong> para confirmarla; luego vuelve y entra.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 text-sm" role="tablist" aria-label="Método de acceso con correo">
            {([['codigo', 'Código por correo'], ['clave', 'Contraseña']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setError(null); }} className={`rounded-full border px-3 py-1 ${mode === id ? 'border-brand/60 bg-panel2' : 'border-line text-muted'}`}>{label}</button>
            ))}
          </div>

          {mode === 'codigo' && !codeSent && (
            <form onSubmit={sendCode} className="space-y-2">
              <label htmlFor="email" className="text-sm text-muted">Correo electrónico</label>
              <div className="flex gap-2">
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" className={`${inputCls} flex-1`} />
                <button type="submit" disabled={!!busy} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">
                  <Mail className="h-4 w-4" aria-hidden /> {busy === 'email' ? 'Enviando…' : 'Enviar código'}
                </button>
              </div>
              <p className="text-xs text-muted">Te mandamos un código al correo. Sin contraseña.</p>
            </form>
          )}

          {mode === 'codigo' && codeSent && (
            <form onSubmit={verifyCode} className="space-y-2">
              <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Te enviamos un código a <strong>{email}</strong>. Revisa también spam o promociones.
              </p>
              <label htmlFor="code" className="text-sm text-muted">Código de verificación</label>
              <div className="flex gap-2">
                <input id="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={12} className={`${inputCls} flex-1 text-center font-mono text-lg tracking-[0.3em]`} />
                <button type="submit" disabled={!!busy || code.length < 6} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">
                  <KeyRound className="h-4 w-4" aria-hidden /> {busy === 'verify' ? 'Verificando…' : 'Entrar'}
                </button>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <button type="button" onClick={() => { setCodeSent(false); setError(null); }} className="hover:text-ink">Cambiar correo</button>
                <button type="button" onClick={() => void sendCode()} disabled={!!busy} className="hover:text-ink disabled:opacity-60">Reenviar código</button>
              </div>
            </form>
          )}

          {mode === 'clave' && (
            <form onSubmit={(e) => { e.preventDefault(); void passwordAuth('entrar'); }} className="space-y-2">
              <label htmlFor="email2" className="text-sm text-muted">Correo electrónico</label>
              <input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" className={inputCls} />
              <label htmlFor="password" className="text-sm text-muted">Contraseña (mínimo 8 caracteres)</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputCls} />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={!!busy} className="h-11 flex-1 rounded-lg bg-brand text-sm font-medium text-bg hover:bg-brand-dim disabled:opacity-60">{busy === 'entrar' ? 'Entrando…' : 'Entrar'}</button>
                <button type="button" onClick={() => void passwordAuth('crear')} disabled={!!busy || !email} className="h-11 flex-1 rounded-lg border border-line text-sm hover:border-brand/60 disabled:opacity-60">{busy === 'crear' ? 'Creando…' : 'Crear cuenta'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con wallet<span className="h-px flex-1 bg-line" /></div>

      <div className="space-y-2">
        <button onClick={() => walletLogin('solana')} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-medium hover:border-brand/60 disabled:opacity-60">
          <Wallet className="h-4 w-4" aria-hidden /> {busy === 'solana' ? 'Esperando firma…' : 'Entrar con wallet de Solana'}
        </button>
        <button onClick={() => walletLogin('ethereum')} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-medium hover:border-brand/60 disabled:opacity-60">
          <Wallet className="h-4 w-4" aria-hidden /> {busy === 'ethereum' ? 'Esperando firma…' : 'Entrar con wallet EVM (Base, ETH, BNB…)'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
