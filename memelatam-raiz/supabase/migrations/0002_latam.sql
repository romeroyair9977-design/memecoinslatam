-- MemeLatam · fase 2: token interno $LATAM, boosts, tesis destacadas y notificaciones.
-- Ejecutar DESPUÉS de 0001_init.sql (SQL Editor de Supabase). Es seguro correrlo una sola vez.
--
-- Principio: el balance NUNCA lo toca el navegador. Todo movimiento de puntos pasa por funciones
-- `security definer` (award_points / spend_points) que solo ejecutan triggers y RPCs controladas.

-- ───────────────────────── PERFIL: balance + blindaje de columnas ─────────────────────────
alter table public.profiles add column if not exists points_balance int not null default 0 check (points_balance >= 0);

-- Antes cualquiera podía hacer UPDATE de todas las columnas de su fila (incluido el balance).
-- Ahora solo estas tres son editables desde el cliente.
revoke update on public.profiles from authenticated, anon;
grant update (username, bio, avatar_url) on public.profiles to authenticated;

-- ───────────────────────── TRANSACCIONES DE PUNTOS ─────────────────────────
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null check (reason in ('bienvenida','tesis','comunidad_creada','reaccion','invitacion','boost','tesis_destacada')),
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists point_tx_user on public.point_transactions (user_id, created_at desc);
create index if not exists point_tx_ref on public.point_transactions (ref_id) where ref_id is not null;

alter table public.point_transactions enable row level security;
drop policy if exists "point_tx_read_own" on public.point_transactions;
create policy "point_tx_read_own" on public.point_transactions for select using (auth.uid() = user_id);
-- Sin policies de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.award_points(p_user uuid, p_amount int, p_reason text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then raise exception 'award_points requiere un monto positivo'; end if;
  update public.profiles set points_balance = points_balance + p_amount where id = p_user;
  if found then
    insert into public.point_transactions (user_id, amount, reason, ref_id) values (p_user, p_amount, p_reason, p_ref);
  end if;
end $$;

create or replace function public.spend_points(p_user uuid, p_amount int, p_reason text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  if p_amount <= 0 then raise exception 'spend_points requiere un monto positivo'; end if;
  select points_balance into bal from public.profiles where id = p_user for update;   -- bloquea la fila: sin doble gasto
  if bal is null then raise exception 'Perfil no encontrado' using errcode = 'P0001'; end if;
  if bal < p_amount then
    raise exception 'No tienes suficientes $LATAM (te faltan %).', p_amount - bal using errcode = 'P0001';
  end if;
  update public.profiles set points_balance = points_balance - p_amount where id = p_user;
  insert into public.point_transactions (user_id, amount, reason, ref_id) values (p_user, -p_amount, p_reason, p_ref);
end $$;

revoke all on function public.award_points from public, anon, authenticated;
revoke all on function public.spend_points from public, anon, authenticated;

-- ───────────────────────── GANAR $LATAM (triggers) ─────────────────────────
-- Bienvenida: 20 $LATAM al crear el perfil (para poder probar un boost enseguida).
create or replace function public.profiles_welcome() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.id, 20, 'bienvenida', null);
  return null;
end $$;
drop trigger if exists profile_welcome on public.profiles;
create trigger profile_welcome after insert on public.profiles
  for each row execute function public.profiles_welcome();

-- Cuentas que ya existían antes de esta migración: mismo regalo de bienvenida (una sola vez).
do $$
declare r record;
begin
  for r in select id from public.profiles p where not exists (select 1 from public.point_transactions t where t.user_id = p.id) loop
    perform public.award_points(r.id, 20, 'bienvenida', null);
  end loop;
end $$;

-- Tesis: +15 (máx. 5 tesis premiadas por día para frenar el farmeo) y aviso a quienes te siguen.
create or replace function public.theses_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.point_transactions
      where user_id = new.user_id and reason = 'tesis' and created_at > now() - interval '24 hours') < 5 then
    perform public.award_points(new.user_id, 15, 'tesis', new.id::text);
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  select f.follower_id, 'thesis', new.user_id,
         jsonb_build_object('username', p.username, 'symbol', t.symbol, 'stance', new.stance, 'chain', t.chain, 'address', t.address)
  from (select follower_id from public.follows where followed_id = new.user_id limit 500) f,
       public.profiles p, public.tokens t
  where p.id = new.user_id and t.token_key = new.token_key;
  return null;
end $$;
drop trigger if exists thesis_rewards on public.theses;
create trigger thesis_rewards after insert on public.theses
  for each row execute function public.theses_rewards();

-- Reacciones: +1 al autor del mensaje (no a ti mismo, solo la primera reacción tuya por mensaje,
-- máx. 30 por día) y notificación.
create or replace function public.reactions_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select user_id into author from public.messages where id = new.message_id;
  if author is null or author = new.user_id then return null; end if;

  if not exists (select 1 from public.reactions r where r.message_id = new.message_id and r.user_id = new.user_id and r.id <> new.id)
     and (select count(*) from public.point_transactions
          where user_id = author and reason = 'reaccion' and created_at > now() - interval '24 hours') < 30 then
    perform public.award_points(author, 1, 'reaccion', new.message_id::text);
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  select author, 'reaction', new.user_id,
         jsonb_build_object('username', p.username, 'emoji', new.emoji, 'community_id', new.community_id)
  from public.profiles p where p.id = new.user_id;
  return null;
end $$;
drop trigger if exists reaction_rewards on public.reactions;
create trigger reaction_rewards after insert on public.reactions
  for each row execute function public.reactions_rewards();

-- Crear una comunidad de token: +50 (máx. 3 premiadas por día). Reemplaza la RPC de 0001.
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

    if (select count(*) from public.point_transactions
        where user_id = p_user_id and reason = 'comunidad_creada' and created_at > now() - interval '24 hours') < 3 then
      perform public.award_points(p_user_id, 50, 'comunidad_creada', cid::text);
    end if;
  end if;

  select count(*) into n from public.community_members where community_id = cid;
  insert into public.community_members (community_id, user_id, role)
  values (cid, p_user_id, case when n < 3 then 'mod' else 'member' end)
  on conflict do nothing;
  return cid;
end $$;
revoke all on function public.join_token_community from public, anon, authenticated;
grant execute on function public.join_token_community to service_role;

-- ───────────────────────── GASTAR $LATAM: BOOSTS ─────────────────────────
create table if not exists public.token_boosts (
  id uuid primary key default gen_random_uuid(),
  token_key text not null references public.tokens(token_key) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists token_boosts_active on public.token_boosts (token_key, expires_at);

alter table public.token_boosts enable row level security;
drop policy if exists "boosts_read" on public.token_boosts;
create policy "boosts_read" on public.token_boosts for select using (true);   -- sin insert: solo vía boost_token()

-- 10 $LATAM = 1 hora de boost. Mínimo 10, máximo 500, múltiplos de 10.
create or replace function public.boost_token(p_token_key text, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicia sesión para dar boost.' using errcode = 'P0001'; end if;
  if p_amount < 10 or p_amount > 500 or p_amount % 10 <> 0 then
    raise exception 'El boost debe ser de 10 a 500 $LATAM, en múltiplos de 10.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tokens where token_key = p_token_key) then
    raise exception 'Token no registrado.' using errcode = 'P0001';
  end if;
  perform public.spend_points(uid, p_amount, 'boost', p_token_key);
  insert into public.token_boosts (token_key, user_id, amount, expires_at)
  values (p_token_key, uid, p_amount, now() + make_interval(hours => p_amount / 10));
end $$;
revoke all on function public.boost_token from public, anon;
grant execute on function public.boost_token to authenticated;

-- Boosts vigentes por token (lo lee el dashboard para ordenar y destacar).
create or replace view public.active_boosts with (security_invoker = true) as
  select token_key, sum(amount)::int as total, count(distinct user_id)::int as boosters, max(expires_at) as expires_at
  from public.token_boosts where expires_at > now() group by token_key;
grant select on public.active_boosts to anon, authenticated;

-- ───────────────────────── GASTAR $LATAM: TESIS DESTACADA ─────────────────────────
alter table public.theses add column if not exists featured_until timestamptz;

-- 20 $LATAM = tu tesis aparece primera durante 24 h (si ya estaba destacada, se suma el tiempo).
create or replace function public.feature_thesis(p_thesis_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicia sesión para destacar.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.theses where id = p_thesis_id and user_id = uid) then
    raise exception 'Solo puedes destacar tus propias tesis.' using errcode = 'P0001';
  end if;
  perform public.spend_points(uid, 20, 'tesis_destacada', p_thesis_id::text);
  update public.theses set featured_until = greatest(coalesce(featured_until, now()), now()) + interval '24 hours'
  where id = p_thesis_id;
end $$;
revoke all on function public.feature_thesis from public, anon;
grant execute on function public.feature_thesis to authenticated;

-- ───────────────────────── NOTIFICACIONES ─────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow','reaction','thesis')),
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_inbox on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notif_read_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_read_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notif_delete_own" on public.notifications for delete using (auth.uid() = user_id);
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;   -- solo puedes marcar como leída

-- Alguien te sigue → notificación.
create or replace function public.follows_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, actor_id, payload)
  select new.followed_id, 'follow', new.follower_id, jsonb_build_object('username', p.username)
  from public.profiles p where p.id = new.follower_id;
  return null;
end $$;
drop trigger if exists follow_notify on public.follows;
create trigger follow_notify after insert on public.follows
  for each row execute function public.follows_notify();

-- ───────────────────────── REALTIME ─────────────────────────
-- profiles: para que el balance del header se actualice solo. notifications: la campana en vivo.
alter publication supabase_realtime add table public.profiles, public.notifications;

-- Tip: para regalarte $LATAM al probar (solo SQL Editor, corre como admin):
--   select public.award_points((select id from public.profiles where username = 'tu_usuario'), 500, 'invitacion', null);
