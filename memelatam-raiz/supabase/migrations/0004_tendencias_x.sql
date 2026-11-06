-- MemeLatam · fase 3b: "Tendencias en X".
-- Un cron (cada 15–30 min) guarda en `x_mentions` los tweets públicos que mencionan cashtags ($TOKEN) o contract
-- addresses; el ranking por ventana (1 h / 6 h / 24 h) se calcula aquí, en SQL. Ejecutar después de 0003.

create table if not exists public.x_mentions (
  id bigint generated always as identity primary key,
  tweet_id text not null,
  term text not null,                   -- '$pepe' (minúsculas) o contract address (EVM en minúsculas, Solana tal cual)
  kind text not null check (kind in ('cashtag', 'address')),
  author text not null default '',
  lang text,
  body text not null,
  likes int not null default 0,
  retweets int not null default 0,
  replies int not null default 0,
  views bigint not null default 0,
  tweeted_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  unique (tweet_id, term)
);
create index if not exists x_mentions_time on public.x_mentions (tweeted_at desc);
create index if not exists x_mentions_term_time on public.x_mentions (term, tweeted_at desc);

alter table public.x_mentions enable row level security;
drop policy if exists "x_mentions_read" on public.x_mentions;
create policy "x_mentions_read" on public.x_mentions for select using (true);   -- son tweets públicos
-- Escritura: solo service_role (el cron). Sin policies de insert/update/delete.

-- Estado del escaneo (hasta dónde llegó el último cron). Solo se puede leer la fecha.
create table if not exists public.x_scan_state (
  id int primary key default 1 check (id = 1),
  last_until bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.x_scan_state (id, last_until) values (1, 0) on conflict do nothing;
alter table public.x_scan_state enable row level security;
drop policy if exists "x_scan_state_read" on public.x_scan_state;
create policy "x_scan_state_read" on public.x_scan_state for select using (true);

-- Ranking de menciones. Ventana p_hours; "reciente" = último 25 % de la ventana.
--   momentum = (menciones/hora recientes) / (menciones/hora del resto), tope 99.
-- Anti-manipulación básica: solo cuentan términos mencionados por al menos 2 autores distintos.
create or replace function public.x_trending(p_hours int default 24, p_limit int default 40)
returns table (term_ text, kind_ text, mentions_ int, authors_ int, engagement_ bigint, recent_ int, previous_ int, momentum_ numeric)
language sql stable set search_path = public as $$
  with src as (
    select m.term, m.kind, m.author,
           (m.likes + m.retweets + m.replies) as eng,
           (m.tweeted_at >= now() - make_interval(mins => p_hours * 15)) as is_recent
    from public.x_mentions m
    where m.tweeted_at >= now() - make_interval(hours => p_hours)
  )
  select s.term, s.kind,
         count(*)::int,
         count(distinct nullif(s.author, ''))::int,
         coalesce(sum(s.eng), 0)::bigint,
         (count(*) filter (where s.is_recent))::int,
         (count(*) filter (where not s.is_recent))::int,
         least(99, round(((count(*) filter (where s.is_recent))::numeric / 0.25)
                / greatest((count(*) filter (where not s.is_recent))::numeric / 0.75, 0.5), 2))
  from src s
  group by s.term, s.kind
  having count(distinct nullif(s.author, '')) >= 2
  order by count(*) desc, coalesce(sum(s.eng), 0) desc
  limit least(p_limit, 100);
$$;

create or replace function public.x_top_tweets(p_term text, p_hours int, p_limit int default 3)
returns table (tweet_id text, author text, lang text, body text, likes int, retweets int, replies int, views bigint, tweeted_at timestamptz)
language sql stable set search_path = public as $$
  select m.tweet_id, m.author, m.lang, m.body, m.likes, m.retweets, m.replies, m.views, m.tweeted_at
  from public.x_mentions m
  where m.term = p_term and m.tweeted_at >= now() - make_interval(hours => p_hours)
  order by (m.likes + m.retweets * 2 + m.replies) desc, m.tweeted_at desc
  limit least(p_limit, 10);
$$;

grant execute on function public.x_trending(int, int) to anon, authenticated;
grant execute on function public.x_top_tweets(text, int, int) to anon, authenticated;
