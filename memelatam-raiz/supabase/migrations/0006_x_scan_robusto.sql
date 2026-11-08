-- MemeLatam · fase 3d: escaneo de X más robusto. Ejecutar después de 0005. Se puede correr más de una vez.
-- Añade: candado para que la actualización automática desde la página no dispare muchos escaneos, el último error
-- (para diagnosticar sin entrar a los logs) y un tope diario de gasto en twitterapi.io.

alter table public.x_scan_state add column if not exists last_started timestamptz;
alter table public.x_scan_state add column if not exists last_error text;
alter table public.x_scan_state add column if not exists spent_day date;
alter table public.x_scan_state add column if not exists spent_usd numeric not null default 0;

-- Reclama el derecho a escanear: devuelve true solo si pasaron al menos p_min_minutes desde el último intento.
-- Es atómico: aunque 100 personas abran la página a la vez, solo una dispara el escaneo.
create or replace function public.x_scan_claim(p_min_minutes int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.x_scan_state
     set last_started = now()
   where id = 1
     and (last_started is null or last_started < now() - make_interval(mins => p_min_minutes))
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.x_scan_claim(int) from public, anon, authenticated;
grant execute on function public.x_scan_claim(int) to service_role;
