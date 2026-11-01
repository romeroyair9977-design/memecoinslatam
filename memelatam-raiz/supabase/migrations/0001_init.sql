-- MemeLatam · esquema inicial (Supabase / Postgres 15+)
-- Ejecutar en: Supabase → SQL Editor, o con `supabase db push`.

create extension if not exists pgcrypto;

-- ───────────────────────── PERFILES ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  bio text check (char_length(bio) <= 200),
  avatar_url text,
  wallet_address text,
  wallet_chain text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (email o wallet).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr text := coalesce(new.raw_user_meta_data->'custom_claims'->>'address', new.raw_user_meta_data->>'address');
  chain text := coalesce(new.raw_user_meta_data->'custom_claims'->>'chain', new.raw_user_meta_data->>'chain');
  base text;
  candidate text;
begin
  base := case
    when addr is not null then lower(left(addr, 4)) || substr(addr, length(addr) - 3)
    when new.email is not null then regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
    else 'latino'
  end;
  if char_length(base) < 3 then base := 'latino'; end if;
  base := left(base, 14);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, username, wallet_address, wallet_chain)
  values (new.id, candidate, addr, chain);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ───────────────────────── TOKENS (metadatos cacheados) ─────────────────────────
create table public.tokens (
  token_key text primary key,              -- "chain:address" (address en minúsculas si es EVM)
  chain text not null,
  address text not null,
  symbol text not null,
  name text not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── COMUNIDADES ─────────────────────────
create type public.community_kind as enum ('general', 'token');

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  kind public.community_kind not null,
  token_key text unique references public.tokens(token_key) on delete cascade,
  name text not null,
  description text,
  member_count int not null default 0,
  message_count int not null default 0,
  last_message_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'general') = (token_key is null))
);
-- Solo puede existir una comunidad general
create unique index one_general_community on public.communities ((kind)) where kind = 'general';

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'mod')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index on public.community_members (user_id);

create or replace function public.is_community_mod(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid() and role = 'mod')
$$;

create or replace function public.is_community_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid())
$$;

-- Mantiene member_count
create or replace function public.bump_member_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
create trigger members_count after insert or delete on public.community_members
  for each row execute function public.bump_member_count();

-- ───────────────────────── MENSAJES ─────────────────────────
-- channel: en la general → general | senales | rugs | nuevas ; en token → chat | posts
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel text not null default 'general' check (channel in ('general','senales','rugs','nuevas','chat','posts')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  image_url text check (image_url is null or image_url like '%/storage/v1/object/public/chat-images/%'),
  reply_to uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_feed on public.messages (community_id, channel, created_at desc);

-- Anti-spam: máx. 6 mensajes cada 15 s por usuario
create or replace function public.messages_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages where user_id = new.user_id and created_at > now() - interval '15 seconds') >= 6 then
    raise exception 'Vas muy rápido. Espera unos segundos.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger messages_rate before insert on public.messages
  for each row execute function public.messages_rate_limit();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.communities set message_count = message_count + 1, last_message_at = new.created_at
  where id = new.community_id;
  return null;
end $$;
create trigger messages_counter after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Solo se permite "soft delete" (moderación o autor): el contenido nunca se edita.
create or replace function public.messages_guard_update() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body or new.user_id is distinct from old.user_id
     or new.community_id is distinct from old.community_id or new.channel is distinct from old.channel
     or new.image_url is distinct from old.image_url or new.reply_to is distinct from old.reply_to then
    raise exception 'Los mensajes no se pueden editar';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := auth.uid();
  end if;
  return new;
end $$;
create trigger messages_guard before update on public.messages
  for each row execute function public.messages_guard_update();

-- ───────────────────────── REACCIONES ─────────────────────────
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🚀','🔥','💀','🐸','👀','💎')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index on public.reactions (community_id);

create or replace function public.reactions_set_community() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select community_id into new.community_id from public.messages where id = new.message_id;
  return new;
end $$;
create trigger reactions_community before insert on public.reactions
  for each row execute function public.reactions_set_community();

-- ───────────────────────── REPORTES (moderación) ─────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','scam','acoso','otro')),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- ───────────────────────── TESIS ─────────────────────────
create table public.theses (
  id uuid primary key default gen_random_uuid(),
  token_key text not null references public.tokens(token_key) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stance text not null check (stance in ('alcista','bajista','cuidado')),
  body text not null check (char_length(body) between 5 and 500),
  created_at timestamptz not null default now()
);
create index on public.theses (token_key, created_at desc);

-- ───────────────────────── FOLLOWS ─────────────────────────
create table public.follows (            -- seguir personas
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.wallet_follows (     -- seguir wallets (insiders, devs, ballenas…)
  user_id uuid not null references public.profiles(id) on delete cascade,
  chain text not null,
  address text not null,
  label text check (char_length(label) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, chain, address)
);

-- ───────────────────────── ACTIVIDAD ─────────────────────────
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('thesis','community_created','member_joined')),
  actor_id uuid references public.profiles(id) on delete cascade,
  token_key text references public.tokens(token_key) on delete cascade,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.activity_events (created_at desc);

create or replace function public.log_thesis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events (type, actor_id, token_key, payload)
  select 'thesis', new.user_id, new.token_key,
         jsonb_build_object('username', p.username, 'symbol', t.symbol, 'stance', new.stance, 'chain', t.chain, 'address', t.address)
  from public.profiles p, public.tokens t where p.id = new.user_id and t.token_key = new.token_key;
  return null;
end $$;
create trigger thesis_activity after insert on public.theses
  for each row execute function public.log_thesis();

create or replace function public.log_community_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'token' then
    insert into public.activity_events (type, actor_id, token_key, payload)
    select 'community_created', new.created_by, new.token_key,
           jsonb_build_object('username', p.username, 'symbol', t.symbol, 'chain', t.chain, 'address', t.address)
    from public.tokens t left join public.profiles p on p.id = new.created_by where t.token_key = new.token_key;
  end if;
  return null;
end $$;
create trigger community_activity after insert on public.communities
  for each row execute function public.log_community_created();

-- ───────────────────────── RPC: registrar token / unirse a su comunidad ─────────────────────────
-- Solo las ejecuta el servidor (service_role) tras validar el token contra DexScreener,
-- así nadie puede inventar tokens o metadatos falsos desde el navegador.
create or replace function public.upsert_token(p_chain text, p_address text, p_symbol text, p_name text, p_image text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  a text := case when p_address ~ '^0x' then lower(p_address) else p_address end;
  k text := p_chain || ':' || a;
begin
  insert into public.tokens (token_key, chain, address, symbol, name, image_url)
  values (k, p_chain, a, p_symbol, p_name, p_image)
  on conflict (token_key) do update set symbol = excluded.symbol, name = excluded.name, image_url = excluded.image_url;
  return k;
end $$;

create or replace function public.join_token_community(
  p_user_id uuid, p_chain text, p_address text, p_symbol text, p_name text, p_image text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  k text := public.upsert_token(p_chain, p_address, p_symbol, p_name, p_image);
  cid uuid;
  n int;
begin
  select id into cid from public.communities where token_key = k;
  if cid is null then
    insert into public.communities (kind, token_key, name, description, created_by)
    values ('token', k, p_symbol, 'Comunidad de ' || p_name, p_user_id)
    returning id into cid;
  end if;

  select count(*) into n from public.community_members where community_id = cid;
  insert into public.community_members (community_id, user_id, role)
  values (cid, p_user_id, case when n < 3 then 'mod' else 'member' end)   -- los 3 primeros miembros moderan
  on conflict do nothing;
  return cid;
end $$;

revoke all on function public.upsert_token from public, anon, authenticated;
revoke all on function public.join_token_community from public, anon, authenticated;
grant execute on function public.upsert_token to service_role;
grant execute on function public.join_token_community to service_role;

-- Comunidad general (semilla)
insert into public.communities (kind, name, description)
values ('general', 'Comunidad General', 'Todo sobre memecoins en español: tesis, señales, rugs y nuevas.');

-- ───────────────────────── ROW LEVEL SECURITY ─────────────────────────
alter table public.profiles enable row level security;
alter table public.tokens enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;
alter table public.theses enable row level security;
alter table public.follows enable row level security;
alter table public.wallet_follows enable row level security;
alter table public.activity_events enable row level security;

-- Lectura pública (el contenido es público; escribir exige cuenta)
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));
create policy "tokens_read" on public.tokens for select using (true);
create policy "communities_read" on public.communities for select using (true);
create policy "members_read" on public.community_members for select using (true);
create policy "members_leave" on public.community_members for delete using (auth.uid() = user_id);
create policy "members_join_general" on public.community_members for insert
  with check (auth.uid() = user_id and role = 'member' and exists (select 1 from public.communities c where c.id = community_id and c.kind = 'general'));
create policy "members_mod_manage" on public.community_members for update using (public.is_community_mod(community_id));

create policy "messages_read" on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (
  auth.uid() = user_id and (
    exists (select 1 from public.communities c where c.id = community_id and c.kind = 'general'
            and channel in ('general','senales','rugs','nuevas'))
    or (public.is_community_member(community_id) and channel in ('chat','posts'))
  ));
create policy "messages_soft_delete" on public.messages for update
  using (auth.uid() = user_id or public.is_community_mod(community_id));

create policy "reactions_read" on public.reactions for select using (true);
create policy "reactions_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on public.reactions for delete using (auth.uid() = user_id);

create policy "reports_insert" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_read_own_or_mod" on public.reports for select using (
  auth.uid() = reporter_id or public.is_admin()
  or public.is_community_mod((select community_id from public.messages m where m.id = message_id)));
create policy "reports_resolve" on public.reports for update using (
  public.is_admin() or public.is_community_mod((select community_id from public.messages m where m.id = message_id)));

create policy "theses_read" on public.theses for select using (true);
create policy "theses_insert" on public.theses for insert with check (auth.uid() = user_id);
create policy "theses_delete" on public.theses for delete using (auth.uid() = user_id or public.is_admin());

create policy "follows_read" on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on public.follows for delete using (auth.uid() = follower_id);

create policy "wallet_follows_own" on public.wallet_follows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "activity_read" on public.activity_events for select using (true);

-- ───────────────────────── REALTIME ─────────────────────────
alter table public.reactions replica identity full;
alter publication supabase_realtime add table public.messages, public.reactions, public.activity_events;

-- ───────────────────────── STORAGE (imágenes del chat) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 3145728, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "chat_images_read" on storage.objects for select using (bucket_id = 'chat-images');
create policy "chat_images_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Para hacerte admin:  update public.profiles set is_admin = true where username = 'tu_usuario';
