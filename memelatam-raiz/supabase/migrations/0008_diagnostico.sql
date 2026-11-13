-- MemeLatam · fase 3f: guarda el diagnóstico de cada corrida de Potencial. Ejecutar después de 0007.
alter table public.app_jobs add column if not exists details jsonb;
