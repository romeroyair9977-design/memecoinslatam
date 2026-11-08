-- MemeLatam · fase 3c: "Potencial" — llamados de Veltrix (x10 / x100 / x1000) con historial auditable.
-- Un cron propone llamados con reglas transparentes (src/lib/potential.ts) y luego los marca como cumplidos o fallados.
-- Ejecutar después de 0004.

create table if not exists public.veltrix_calls (
  id uuid primary key default gen_random_uuid(),
  token_key text not null,                       -- 'solana:<address>' (EVM en minúsculas)
  chain text not null,
  address text not null,
  symbol text not null,
  name text not null,
  image text,
  multiple int not null check (multiple in (10, 100, 1000)),
  entry_price numeric not null check (entry_price > 0),
  entry_mc numeric not null,
  target_mc numeric not null,
  score int not null,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'hit', 'missed')),
  peak_multiple numeric not null default 1,      -- el mayor múltiplo (precio / precio de entrada) visto en las revisiones
  resolved_at timestamptz,
  hit_at timestamptz
);
-- Un solo llamado abierto por token y múltiplo.
create unique index if not exists veltrix_calls_one_open on public.veltrix_calls (token_key, multiple) where status = 'open';
create index if not exists veltrix_calls_status on public.veltrix_calls (status, created_at desc);
create index if not exists veltrix_calls_token on public.veltrix_calls (token_key);

alter table public.veltrix_calls enable row level security;
drop policy if exists "veltrix_calls_read" on public.veltrix_calls;
create policy "veltrix_calls_read" on public.veltrix_calls for select using (true);   -- historial público
-- Escritura: solo service_role (el cron). Sin policies de insert/update/delete.
