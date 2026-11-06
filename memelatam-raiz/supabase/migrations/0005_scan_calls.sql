-- MemeLatam · fase 4: "Radar x10 · x100 · x1000".
-- El sistema registra por sí solo las memecoins que cumplen reglas de calidad, anota el precio de entrada y la meta
-- (x10, x100 o x1000), y un cron revisa si la alcanzaron. Nada se borra: los aciertos Y los fallos cuentan en la tasa.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr más de una vez.

create table if not exists public.scan_calls (
  id bigint generated always as identity primary key,
  chain text not null,
  address text not null,
  symbol text not null,
  name text not null,
  image_url text,
  target_x int not null check (target_x in (10, 100, 1000)),
  entry_price numeric not null check (entry_price > 0),
  entry_mcap numeric not null default 0,
  entry_liquidity numeric not null default 0,
  score numeric not null default 0,
  reasons text[] not null default '{}',
  peak_price numeric not null,
  last_price numeric not null,
  status text not null default 'open' check (status in ('open', 'hit', 'miss')),
  called_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  last_checked_at timestamptz,
  unique (chain, address)            -- una sola llamada por token: no se repite para maquillar resultados
);
create index if not exists scan_calls_status_time on public.scan_calls (status, called_at desc);

alter table public.scan_calls enable row level security;
drop policy if exists "scan_calls_read" on public.scan_calls;
create policy "scan_calls_read" on public.scan_calls for select using (true);   -- el historial es público
-- Escritura: solo service_role (el cron). Sin policies de insert/update/delete.
