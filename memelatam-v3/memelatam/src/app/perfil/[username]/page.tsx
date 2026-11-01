import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditProfile, FollowUserButton, TrackedWallets } from '@/components/profile/ProfileClient';
import { DemoBanner } from '@/components/community/parts';
import { getMe } from '@/lib/auth';
import { getProfileByUsername } from '@/lib/services/community';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createServerSupabase } from '@/lib/supabase/server';
import { cn, formatAge, shortAddress } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STANCE = {
  alcista: { label: 'Alcista', cls: 'text-emerald-300' },
  bajista: { label: 'Bajista', cls: 'text-rose-300' },
  cuidado: { label: 'Precaución', cls: 'text-amber-300' },
} as const;

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return { title: `@${params.username}`, description: `Perfil de @${params.username} en MemeLatam: tesis y actividad.` };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  if (!isSupabaseConfigured) {
    return <div className="space-y-4"><DemoBanner /><p className="text-muted">Los perfiles se activan al conectar Supabase.</p></div>;
  }
  const data = await getProfileByUsername(decodeURIComponent(params.username));
  if (!data) notFound();
  const { profile, followers, following, theses } = data;

  const me = await getMe();
  const isMe = me?.id === profile.id;
  const sb = createServerSupabase();

  let iFollow = false;
  let wallets: { chain: string; address: string; label: string | null }[] = [];
  if (me && sb) {
    if (!isMe) {
      const { data: f } = await sb.from('follows').select('followed_id').eq('follower_id', me.id).eq('followed_id', profile.id).maybeSingle();
      iFollow = !!f;
    } else {
      const { data: w } = await sb.from('wallet_follows').select('chain, address, label').eq('user_id', me.id).order('created_at', { ascending: false });
      wallets = w ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-panel2 font-display text-xl font-bold uppercase text-muted" aria-hidden>{profile.username.slice(0, 2)}</div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">@{profile.username}</h1>
          <p className="text-sm text-muted">
            {followers} {followers === 1 ? 'seguidor' : 'seguidores'} · {following} siguiendo · se unió {formatAge(new Date(profile.created_at).getTime())}
            {profile.wallet_address && <> · wallet {shortAddress(profile.wallet_address, 4)}</>}
          </p>
          {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>
        {!isMe && <FollowUserButton targetId={profile.id} meId={me?.id ?? null} initiallyFollowing={iFollow} />}
      </header>

      {isMe && (
        <section className="rounded-xl border border-line bg-panel/50 p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Tu perfil</h2>
          <EditProfile userId={me.id} username={profile.username} bio={profile.bio} />
        </section>
      )}

      {isMe && (
        <section className="rounded-xl border border-line bg-panel/50 p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Wallets que sigues</h2>
          <TrackedWallets userId={me.id} initial={wallets} />
        </section>
      )}

      <section className="rounded-xl border border-line bg-panel/50 p-4">
        <h2 className="mb-3 font-display text-lg font-semibold">Tesis recientes</h2>
        {theses.length === 0 ? (
          <p className="text-sm text-muted">Todavía no ha publicado tesis.</p>
        ) : (
          <ul className="space-y-2">
            {theses.map((t) => (
              <li key={t.id} className="rounded-lg border border-line bg-panel p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <span className={cn('font-medium', STANCE[t.stance].cls)}>{STANCE[t.stance].label}</span>
                  {t.tokens && <Link href={`/token/${t.tokens.address}?chain=${t.tokens.chain}`} className="font-medium text-brand hover:underline">${t.tokens.symbol}</Link>}
                  <span>· {formatAge(new Date(t.created_at).getTime())}</span>
                </p>
                {t.body}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
