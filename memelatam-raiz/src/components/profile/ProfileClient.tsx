'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Trash2, UserCheck, UserPlus } from 'lucide-react';
import { detectAddressKind } from '@/lib/addresses';
import { CHAINS, chainLabel } from '@/lib/chains';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { cn, shortAddress } from '@/lib/utils';

/** Seguir / dejar de seguir a un usuario. */
export function FollowUserButton({ targetId, meId, initiallyFollowing }: { targetId: string; meId: string | null; initiallyFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (!meId) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(true);
    const { error } = following
      ? await sb.from('follows').delete().eq('follower_id', meId).eq('followed_id', targetId)
      : await sb.from('follows').insert({ follower_id: meId, followed_id: targetId });
    setBusy(false);
    if (!error) { setFollowing(!following); router.refresh(); }
  }

  return (
    <button onClick={toggle} disabled={busy} className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60', following ? 'border border-line text-muted hover:text-ink' : 'bg-brand text-bg hover:bg-brand-dim')}>
      {following ? <UserCheck className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}

/** Seguir una wallet concreta (p. ej. un holder del top 10 o un posible dev). */
export function FollowWalletButton({ chain, address, loggedIn, initiallyFollowing }: { chain: string; address: string; loggedIn: boolean; initiallyFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (!loggedIn) return router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setBusy(false); return; }
    const { error } = following
      ? await sb.from('wallet_follows').delete().eq('user_id', uid).eq('chain', chain).eq('address', address)
      : await sb.from('wallet_follows').insert({ user_id: uid, chain, address });
    setBusy(false);
    if (!error) setFollowing(!following);
  }

  return (
    <button onClick={toggle} disabled={busy} aria-pressed={following} className={cn('rounded border px-2 py-0.5 text-xs disabled:opacity-60', following ? 'border-brand/60 text-brand' : 'border-line text-muted hover:text-ink')}>
      {following ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}

interface TrackedWallet { chain: string; address: string; label: string | null }

/** Gestor de wallets seguidas (privado: RLS solo deja ver las propias). */
export function TrackedWallets({ userId, initial }: { userId: string; initial: TrackedWallet[] }) {
  const [items, setItems] = useState(initial);
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('solana');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    const a = address.trim();
    const kind = detectAddressKind(a);
    if (!sb || !kind) return setError('Pega una dirección válida.');
    if ((kind === 'solana') !== (chain === 'solana')) return setError('La dirección no corresponde a la red elegida.');
    const addr = kind === 'evm' ? a.toLowerCase() : a;
    const { error: err } = await sb.from('wallet_follows').insert({ user_id: userId, chain, address: addr, label: label.trim() || null });
    if (err) return setError(err.code === '23505' ? 'Ya sigues esta wallet.' : 'No se pudo guardar.');
    setItems((p) => [{ chain, address: addr, label: label.trim() || null }, ...p]);
    setAddress(''); setLabel(''); setError(null);
  }

  async function remove(w: TrackedWallet) {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { error: err } = await sb.from('wallet_follows').delete().eq('user_id', userId).eq('chain', w.chain).eq('address', w.address);
    if (!err) setItems((p) => p.filter((x) => !(x.chain === w.chain && x.address === w.address)));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[110px_1fr_140px_auto]">
        <select value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Red" className="h-10 rounded-lg border border-line bg-panel px-2 text-sm">
          {Object.values(CHAINS).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección de la wallet" aria-label="Dirección" spellCheck={false} className="h-10 rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Etiqueta (opcional)" aria-label="Etiqueta" className="h-10 rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted" />
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-bg hover:bg-brand-dim">Seguir</button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted">Sigue wallets de devs, ballenas o insiders para tenerlas a mano. Solo tú las ves.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((w) => (
            <li key={`${w.chain}:${w.address}`} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2 text-sm">
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{chainLabel(w.chain)}</span>
              <span className="min-w-0 flex-1 truncate">{w.label ? <strong className="mr-2 font-medium">{w.label}</strong> : null}<span className="font-mono text-xs text-muted">{shortAddress(w.address, 6)}</span></span>
              <button onClick={() => remove(w)} aria-label="Dejar de seguir wallet" className="text-muted hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Edición de perfil propio: usuario y bio. */
export function EditProfile({ userId, username, bio }: { userId: string; username: string; bio: string | null }) {
  const router = useRouter();
  const [u, setU] = useState(username);
  const [b, setB] = useState(bio ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) return setMsg({ ok: false, text: 'Usuario: 3–20 caracteres, letras, números o _.' });
    const { error } = await sb.from('profiles').update({ username: u, bio: b.trim() || null }).eq('id', userId);
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'Ese usuario ya existe.' : 'No se pudo guardar.' });
    setMsg({ ok: true, text: 'Guardado.' });
    if (u !== username) router.replace(`/perfil/${u}`); else router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label className="block text-sm text-muted" htmlFor="username">Usuario</label>
      <input id="username" value={u} onChange={(e) => setU(e.target.value)} maxLength={20} className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm" />
      <label className="block text-sm text-muted" htmlFor="bio">Bio</label>
      <textarea id="bio" value={b} onChange={(e) => setB(e.target.value)} maxLength={200} rows={2} placeholder="¿Qué cazas? ¿Memes nuevos, migraciones, rugs?" className="w-full rounded-lg border border-line bg-panel p-3 text-sm placeholder:text-muted" />
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:bg-brand-dim">Guardar</button>
        {msg && <p role="status" className={cn('text-sm', msg.ok ? 'text-emerald-300' : 'text-rose-400')}>{msg.text}</p>}
      </div>
    </form>
  );
}
