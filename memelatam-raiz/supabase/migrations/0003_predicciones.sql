-- Veltrix Coin · fase 3: recompensas más bajas, predicciones de permanencia (ranking de aciertos) y wallets populares.
-- Ejecutar DESPUÉS de 0001 y 0002 (SQL Editor de Supabase). Es seguro correrlo más de una vez.

-- ───────────────────────── 1. REGALAR MENOS $LATAM ─────────────────────────
-- Antes: bienvenida 20 · tesis 15 (5/día) · comunidad 50 (3/día) · reacción 1 (30/día).
-- Ahora: bienvenida 5 · tesis 3 (3/día) · comunidad 10 (2/día) · reacción 1 (10/día).
-- (si cambias un monto, cámbialo también en src/lib/latam.ts, que solo lo muestra en la UI)
create or replace function public.profiles_welcome() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.id, 5, 'bienvenida', null);
  return null;
end $$;

create or replace function public.theses_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.point_transactions
      where user_id = new.user_id and reason = 'tesis' and created_at > now() - interval '24 hours') < 3 then
    perform public.award_points(new.user_id, 3, 'tesis', new.id::text);
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  select f.follower_id, 'thesis', new.user_id,
         jsonb_build_object('username', p.username, 'symbol', t.symbol, 'stance', new.stance, 'chain', t.chain, 'address', t.address)
  from (select follower_id from public.follows where followed_id = new.user_id limit 500) f,
       public.profiles p, public.tokens t
  where p.id = new.user_id and t.token_key = new.token_key;
  return null;
end $$;

create or replace function public.reactions_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select user_id into author from public.messages where id = new.message_id;
  if author is null or author = new.user_id then return null; end if;

  if not exists (select 1 from public.reactions r where r.message_id = new.message_id and r.user_id = new.user_id and r.id <> new.id)
     and (select count(*) from public.point_transactions
          where user_id = author and reason = 'reaccion' and created_at > now() - interval '24 hours') < 10 then
    perform public.award_points(author, 1, 'reaccion', new.message_id::text);
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  select author, 'reaction', new.user_id,
         jsonb_build_object('username', p.username, 'emoji', new.emoji, 'community_id', new.community_id)
  from public.profiles p where p.id = new.user_id;
  return null;
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

    if (select count(*) from public.point_transactions
        where user_id = p_user_id and reason = 'comunidad_creada' and created_at > now() - interval '24 hours') < 2 then
      perform public.award_points(p_user_id, 10, 'comunidad_creada', cid::text);
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

-- Nuevo motivo de movimiento: premio por acertar una predicción.
alter table public.point_transactions drop constraint if exists point_transactions_reason_check;
alter table public.point_transactions add constraint point_transactions_reason_check
  check (reason in ('bienvenida','tesis','comunidad_creada','reaccion','invitacion','boost','tesis_destacada','prediccion'));

-- ───────────────────────── 2. PREDICCIONES DE PERMANENCIA ─────────────────────────
-- "¿Esta memecoin seguirá viva en X días?" Se resuelve sola al vencer; solo se paga si aciertas.
-- Cuanto más largo el plazo, mayor el premio (7 d = 2 · 30 d = 6 · 90 d = 15 · 180 d = 30 $LATAM;
-- apostar a que MUERE paga la mitad). "Viva" = liquidez ≥ $5K y volumen 24 h ≥ $1K al vencer.
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_key text not null references public.tokens(token_key) on delete cascade,
  side text not null check (side in ('vive','muere')),
  horizon_days int not null check (horizon_days in (7,30,90,180)),
  category text not null default 'general' check (category in ('general','ia','animales','celebridades')),
  entry_liquidity numeric not null,
  entry_price numeric,
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','hit','miss')),
  resolved_at timestamptz,
  reward int not null default 0,
  unique (user_id, token_key)                      -- una predicción por token y persona
);
create index if not exists predictions_due on public.predictions (due_at) where status = 'pending';
create index if not exists predictions_user on public.predictions (user_id, created_at desc);

alter table public.predictions enable row level security;
drop policy if exists "predictions_read" on public.predictions;
create policy "predictions_read" on public.predictions for select using (true);   -- el ranking es público
-- Sin insert/update/delete desde el cliente: solo las funciones de abajo (las llama el servidor con service_role).

-- Crear: máx. 5 predicciones nuevas por día y por persona (frena el farmeo).
create or replace function public.create_prediction(
  p_user uuid, p_token_key text, p_side text, p_days int, p_category text, p_liquidity numeric, p_price numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if (select count(*) from public.predictions where user_id = p_user and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Máximo 5 predicciones por día.' using errcode = 'P0001';
  end if;
  insert into public.predictions (user_id, token_key, side, horizon_days, category, entry_liquidity, entry_price, due_at)
  values (p_user, p_token_key, p_side, p_days, p_category, p_liquidity, p_price, now() + make_interval(days => p_days))
  returning id into pid;
  return pid;
exception when unique_violation then
  raise exception 'Ya hiciste una predicción sobre este token.' using errcode = 'P0001';
end $$;
revoke all on function public.create_prediction from public, anon, authenticated;
grant execute on function public.create_prediction to service_role;

-- Resolver: marca acierto/fallo (una sola vez) y paga el premio.
create or replace function public.resolve_prediction(p_id uuid, p_alive boolean)
returns int language plpgsql security definer set search_path = public as $$
declare pr public.predictions; hit boolean; pay int := 0;
begin
  select * into pr from public.predictions where id = p_id and status = 'pending' and due_at <= now() for update;
  if not found then return 0; end if;
  hit := (pr.side = 'vive' and p_alive) or (pr.side = 'muere' and not p_alive);
  if hit then
    pay := case pr.horizon_days when 7 then 2 when 30 then 6 when 90 then 15 else 30 end;
    if pr.side = 'muere' then pay := greatest(1, pay / 2); end if;
    perform public.award_points(pr.user_id, pay, 'prediccion', pr.id::text);
  end if;
  update public.predictions set status = case when hit then 'hit' else 'miss' end, resolved_at = now(), reward = pay where id = p_id;
  return pay;
end $$;
revoke all on function public.resolve_prediction from public, anon, authenticated;
grant execute on function public.resolve_prediction to service_role;

-- Ranking de aciertos por persona y categoría (la app suma las categorías para el "Todas").
create or replace view public.prediction_leaderboard with (security_invoker = true) as
  select p.user_id, pr.username, pr.avatar_url, p.category,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status = 'miss')::int as misses,
         count(*) filter (where p.status = 'pending')::int as pending,
         coalesce(sum(p.reward), 0)::int as earned,
         coalesce(max(p.horizon_days) filter (where p.status = 'hit' and p.side = 'vive'), 0)::int as best_horizon
  from public.predictions p join public.profiles pr on pr.id = p.user_id
  group by p.user_id, pr.username, pr.avatar_url, p.category;
grant select on public.prediction_leaderboard to anon, authenticated;

-- ───────────────────────── 3. WALLETS POPULARES ─────────────────────────
-- Cuántas personas guardaron cada wallet. Solo cifras: nunca quién ni con qué etiqueta (wallet_follows sigue siendo privada).
create or replace view public.popular_wallets as
  select chain, address, count(*)::int as savers from public.wallet_follows group by chain, address;
grant select on public.popular_wallets to anon, authenticated;
