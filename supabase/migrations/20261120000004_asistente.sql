-- Registro de consultas al asistente con IA: límite diario por persona y control de gasto.
create table ai_requests (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('dictado', 'foto')),
  model         text not null,
  input_tokens  int,
  output_tokens int,
  ok            boolean not null default true,
  created_at    timestamptz not null default now()
);
create index ai_requests_user_idx on ai_requests (user_id, created_at desc);

-- Solo la Edge Function (service role) escribe. El admin puede ver el consumo.
alter table ai_requests enable row level security;
create policy admin_read on ai_requests for select using (public.is_admin());

-- Resumen mensual de uso para el administrador
create or replace view ai_usage_monthly with (security_invoker = true) as
select date_trunc('month', created_at) as mes, count(*) as consultas,
       sum(input_tokens) as tokens_entrada, sum(output_tokens) as tokens_salida
from ai_requests group by 1 order by 1 desc;
