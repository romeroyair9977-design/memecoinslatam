-- MemeLatam · fase 3e: tareas que se disparan solas (sin cron externo) y datos para los llamados v2.
-- Ejecutar después de 0006. Se puede correr más de una vez.

-- Registro de tareas periódicas (Potencial, resolución de predicciones). Sin policies: solo service_role.
create table if not exists public.app_jobs (
  key text primary key,
  last_started timestamptz,
  last_finished timestamptz,
  last_error text
);
alter table public.app_jobs enable row level security;

-- Reclama el derecho a correr una tarea: true solo si pasaron p_min_minutes desde la última vez. Atómico.
create or replace function public.job_claim(p_key text, p_min_minutes int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into public.app_jobs (key, last_started) values (p_key, now())
  on conflict (key) do update set last_started = now()
    where public.app_jobs.last_started is null
       or public.app_jobs.last_started < now() - make_interval(mins => p_min_minutes)
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.job_claim(text, int) from public, anon, authenticated;
grant execute on function public.job_claim(text, int) to service_role;

-- Llamados: par principal (para revisar las velas) y cuándo se revisó por última vez.
alter table public.veltrix_calls add column if not exists pair_address text;
alter table public.veltrix_calls add column if not exists checked_at timestamptz;
