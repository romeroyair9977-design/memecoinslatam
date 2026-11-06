-- MemeLatam · fase 3: premios más bajos al inicio + predicciones de permanencia + ranking.
-- Ejecutar DESPUÉS de 0001_init.sql y 0002_latam.sql (SQL Editor de Supabase). Se puede correr más de una vez.
--
-- Principio (igual que 0002): el navegador NUNCA escribe puntos. Las predicciones se crean y se resuelven con RPCs
-- `security definer` que solo puede llamar el servidor (service_role), después de verificar el token contra DexScreener.

-- ───────────────────────── 1) PREMIOS MÁS BAJOS ─────────────────────────
-- Antes: bienvenida 20 · tesis 15 · comunidad 50. Ahora: 5 · 2 · 10, con topes diarios más cortos.
-- (Las cuentas que ya recibieron sus 20 de bienvenida no pierden nada.)
create or replace function public.profiles_welcome() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.id, 5, 'bienvenida', null);
  return null;
end $$;

create or replace function public.theses_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- +2 por tesis, máximo 3 premiadas por día.
  if (select count(*) from public.point_transactions
      where user_id = new.user_id and reason = 'tesis' and created_at > now() - interval '24 hours') < 3 then
    perform public.award_points(new.user_id, 2, 'tesis', new.id::text);
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

  -- +1 por la primera reacción de cada persona a un mensaje, máximo 10 por día.
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

    -- +10 por crear una comunidad, máximo 2 premiadas por día.
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

-- ───────────────────────── 2) NUEVOS MOTIVOS DE MOVIMIENTO ─────────────────────────
alter table public.point_transactions drop constraint if exists point_transactions_reason_check;
alter table public.point_transactions add constraint point_transactions_reason_check
  check (reason in ('bienvenida','tesis','comunidad_creada','reaccion','invitacion','boost','tesis_destacada','prediccion','prediccion_ganada'));

-- ───────────────────────── 3) PREDICCIONES DE PERMANENCIA ─────────────────────────
-- "¿Seguirá viva esta memecoin dentro de 7 / 30 / 90 días?"  Cuesta 2 $LATAM; si aciertas recibes 4.
-- Definición de "viva" (la aplica el servidor al resolver, ver src/lib/predictions.ts):
--   el token sigue listado, su liquidez es ≥ max($5.000, 30 % de la liquidez que tenía al predecir) y mueve ≥ $1.000 al día.
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_key text not null references public.tokens(token_key) on delete cascade,
  side text not null check (side in ('vive','muere')),
  horizon_days int not null check (horizon_days in (7, 30, 90)),
  stake int not null default 2 check (stake > 0),
  liquidity_at_open numeric not null default 0,
  created_at timestamptz not null default now(),
  resolves_at timestamptz not null,
  status text not null default 'open' check (status in ('open','won','lost')),
  resolved_at timestamptz,
  payout int not null default 0
);
-- Una predicción abierta por persona, token y plazo (no se puede repetir para farmear).
create unique index if not exists predictions_one_open on public.predictions (user_id, token_key, horizon_days) where status = 'open';
create index if not exists predictions_due on public.predictions (status, resolves_at);
create index if not exists predictions_token on public.predictions (token_key);

alter table public.predictions enable row level security;
drop policy if exists "predictions_read" on public.predictions;
create policy "predictions_read" on public.predictions for select using (true);   -- públicas: el ranking es transparente
-- Sin policies de escritura: solo las RPC de abajo.

create or replace function public.place_prediction(p_user_id uuid, p_token_key text, p_days int, p_side text, p_liquidity numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if p_days not in (7, 30, 90) then raise exception 'Plazo no válido.' using errcode = 'P0001'; end if;
  if p_side not in ('vive', 'muere') then raise exception 'Postura no válida.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.tokens where token_key = p_token_key) then
    raise exception 'Token no registrado.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.predictions where user_id = p_user_id and status = 'open') >= 10 then
    raise exception 'Tienes 10 predicciones abiertas. Espera a que se resuelvan algunas.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.predictions where user_id = p_user_id and token_key = p_token_key and horizon_days = p_days and status = 'open') then
    raise exception 'Ya tienes una predicción abierta para este token y plazo.' using errcode = 'P0001';
  end if;

  perform public.spend_points(p_user_id, 2, 'prediccion', p_token_key);   -- falla si no alcanza el balance
  insert into public.predictions (user_id, token_key, side, horizon_days, stake, liquidity_at_open, resolves_at)
  values (p_user_id, p_token_key, p_side, p_days, 2, coalesce(p_liquidity, 0), now() + make_interval(days => p_days))
  returning id into pid;
  return pid;
end $$;
revoke all on function public.place_prediction from public, anon, authenticated;
grant execute on function public.place_prediction to service_role;

-- La llama el servidor (cron) cuando ya consultó el estado real del token. Idempotente: solo resuelve filas abiertas y vencidas.
create or replace function public.resolve_prediction(p_id uuid, p_alive boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r public.predictions%rowtype; won boolean;
begin
  select * into r from public.predictions where id = p_id and status = 'open' and resolves_at <= now() for update;
  if not found then return 'skip'; end if;
  won := (r.side = 'vive') = p_alive;
  if won then
    update public.predictions set status = 'won', resolved_at = now(), payout = r.stake * 2 where id = r.id;
    perform public.award_points(r.user_id, r.stake * 2, 'prediccion_ganada', r.id::text);
    return 'won';
  end if;
  update public.predictions set status = 'lost', resolved_at = now(), payout = 0 where id = r.id;
  return 'lost';
end $$;
revoke all on function public.resolve_prediction from public, anon, authenticated;
grant execute on function public.resolve_prediction to service_role;

-- ───────────────────────── 4) RANKING ─────────────────────────
create or replace view public.prediction_leaderboard with (security_invoker = true) as
select
  p.id as user_id, p.username, p.avatar_url,
  count(*) filter (where pr.status = 'won')::int  as wins,
  count(*) filter (where pr.status = 'lost')::int as losses,
  count(*) filter (where pr.status = 'open')::int as open_count,
  coalesce(sum(pr.payout - pr.stake) filter (where pr.status <> 'open'), 0)::int as net_latam,
  coalesce(max(pr.horizon_days) filter (where pr.status = 'won'), 0)::int as best_horizon
from public.profiles p
join public.predictions pr on pr.user_id = p.id
group by p.id, p.username, p.avatar_url;
grant select on public.prediction_leaderboard to anon, authenticated;
