-- =====================================================================
-- COPA ARRAYANES · Esquema principal
-- Vereda Los Arrayanes, Córdoba, Nariño, Colombia
-- Ejecutar en Supabase: SQL Editor (o `supabase db push`).
-- =====================================================================

-- gen_random_uuid() es nativo en PostgreSQL 13+

-- ---------- Tipos ----------
create type staff_role      as enum ('admin', 'organizador', 'planillero', 'delegado');
create type edition_status  as enum ('planificacion', 'inscripcion', 'en_desarrollo', 'finalizado');
create type branch          as enum ('masculino', 'femenino', 'mixto', 'veteranos');
create type match_stage     as enum ('liga', 'grupo', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final');
create type match_status    as enum ('programado', 'en_juego', 'finalizado', 'aplazado', 'cancelado');
create type event_type      as enum ('gol', 'autogol', 'amarilla', 'roja');
create type report_status   as enum ('pendiente', 'aprobado', 'rechazado');
create type notice_kind     as enum ('partido', 'comunidad', 'ventas');

-- ---------- Personal (solo quienes administran tienen cuenta) ----------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 80),
  role        staff_role not null default 'delegado',
  team_id     uuid,                       -- solo delegados
  created_at  timestamptz not null default now()
);

-- ---------- Catálogos ----------
create table sports (
  id          text primary key,           -- 'microfutbol', 'baloncesto'
  name        text not null,
  active      boolean not null default true,
  -- Términos para la interfaz: goles/puntos, etc.
  score_label text not null default 'goles'
);

create table veredas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 60),
  municipality text not null default 'Córdoba (Nariño)'
);

-- ---------- Ediciones ----------
create table editions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 80),
  year        int  not null check (year between 2000 and 2100),
  start_date  date,
  end_date    date,
  status      edition_status not null default 'planificacion',
  based_on    uuid references editions (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- Una categoría = deporte + rama dentro de una edición, con su formato.
create table categories (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references editions (id) on delete cascade,
  sport_id      text not null references sports (id),
  branch        branch not null,
  name          text not null check (char_length(name) between 2 and 60),
  -- Formato configurable (ver src/lib/domain/formats.ts)
  format        text not null default 'grupos'
                check (format in ('todos_contra_todos', 'grupos', 'cuadrangular', 'octagonal')),
  group_count   int  not null default 1 check (group_count between 1 and 8),
  knockout_size int  not null default 4 check (knockout_size in (0, 2, 4, 8, 16)),
  third_place   boolean not null default true,
  points_win    int  not null default 3,
  points_draw   int  not null default 1,
  points_loss   int  not null default 0,
  -- Orden de desempate
  tiebreakers   text[] not null default array['puntos','diferencia','juego_limpio','goles_favor'],
  created_at    timestamptz not null default now(),
  unique (edition_id, sport_id, branch, name)
);

-- ---------- Equipos y jugadores (persisten entre ediciones) ----------
create table teams (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 60),
  short_name      text check (char_length(short_name) between 2 and 4),
  vereda_id       uuid references veredas (id) on delete set null,
  crest_shape     text not null default 'escudo' check (crest_shape in ('escudo','circulo','hexagono','diamante')),
  color_primary   text not null default '#1d4ed8' check (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary text not null default '#ffffff' check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  crest_url       text,                    -- foto opcional en Storage
  created_at      timestamptz not null default now(),
  unique (name)
);

alter table profiles
  add constraint profiles_team_fk foreign key (team_id) references teams (id) on delete set null;

create table players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 3 and 80),
  number      int check (number between 0 and 99),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Equipo inscrito en una categoría de una edición
create table category_teams (
  category_id uuid not null references categories (id) on delete cascade,
  team_id     uuid not null references teams (id) on delete restrict,
  group_label text check (group_label ~ '^[A-H]$'),
  primary key (category_id, team_id)
);

-- ---------- Partidos ----------
create table matches (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references categories (id) on delete cascade,
  stage           match_stage not null,
  group_label     text,
  round           int not null default 1,
  bracket_slot    int,                       -- posición en la llave
  home_team_id    uuid references teams (id),
  away_team_id    uuid references teams (id),
  scheduled_at    timestamptz,
  venue           text,
  status          match_status not null default 'programado',
  home_score      int check (home_score >= 0),
  away_score      int check (away_score >= 0),
  home_penalties  int check (home_penalties >= 0),
  away_penalties  int check (away_penalties >= 0),
  notes           text check (char_length(notes) <= 500),
  reminder_sent   boolean not null default false,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check (status <> 'finalizado' or (home_score is not null and away_score is not null))
);
create index matches_category_idx  on matches (category_id);
create index matches_scheduled_idx on matches (scheduled_at);

-- Planilla (opcional): goles y tarjetas por jugador
create table match_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches (id) on delete cascade,
  team_id     uuid not null references teams (id),
  player_id   uuid references players (id) on delete set null,
  type        event_type not null,
  minute      int check (minute between 0 and 200),
  created_at  timestamptz not null default now()
);
create index match_events_match_idx on match_events (match_id);

-- Planillas enviadas por planilleros: requieren verificación del organizador
create table match_reports (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) default auth.uid(),
  data         jsonb not null,   -- { home_score, away_score, home_penalties?, away_penalties?, events: [...] }
  status       report_status not null default 'pendiente',
  reviewed_by  uuid references auth.users (id),
  review_note  text,
  created_at   timestamptz not null default now()
);

-- Podio histórico (1° a 4°), inmutable al cerrar la edición
create table category_podium (
  category_id uuid not null references categories (id) on delete cascade,
  position    int  not null check (position between 1 and 4),
  team_id     uuid not null references teams (id),
  primary key (category_id, position)
);

-- ---------- Comunidad ----------
create table notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 80),
  body        text check (char_length(body) <= 280),
  kind        notice_kind not null default 'comunidad',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references editions (id) on delete cascade,
  storage_path text not null,
  caption      text check (char_length(caption) <= 140),
  created_at   timestamptz not null default now()
);

-- ---------- Notificaciones push (visitantes sin cuenta) ----------
create table push_subscriptions (
  endpoint           text primary key,
  p256dh             text not null,
  auth_key           text not null,
  favorite_team_ids  uuid[] not null default '{}',
  favorite_vereda_ids uuid[] not null default '{}',
  notify_all         boolean not null default false,
  created_at         timestamptz not null default now(),
  last_seen          timestamptz not null default now()
);

create table notification_queue (
  id          bigint generated always as identity primary key,
  kind        text not null,                -- 'recordatorio' | 'resultado'
  title       text not null,
  body        text not null,
  url         text not null default '/',
  team_ids    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    int not null default 0
);

-- =====================================================================
-- Funciones auxiliares de autorización
-- =====================================================================
create or replace function public.my_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','organizador') from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create or replace function public.my_team() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from profiles where id = auth.uid() and role = 'delegado'
$$;

-- =====================================================================
-- Integridad histórica: una edición finalizada no se modifica
-- =====================================================================
create or replace function public.edition_of_category(cat uuid) returns edition_status
language sql stable security definer set search_path = public as $$
  select e.status from categories c join editions e on e.id = c.edition_id where c.id = cat
$$;

create or replace function public.guard_closed_edition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cat uuid;
  st  edition_status;
begin
  if tg_table_name = 'categories' then
    select status into st from editions where id = coalesce(new.edition_id, old.edition_id);
  else
    if tg_table_name in ('matches','category_teams','category_podium') then
      cat := coalesce(new.category_id, old.category_id);
    elsif tg_table_name = 'match_events' then
      select category_id into cat from matches where id = coalesce(new.match_id, old.match_id);
    end if;
    st := edition_of_category(cat);
  end if;
  if st = 'finalizado' then
    raise exception 'EDICION_CERRADA: la edición está finalizada y su historial no se puede modificar'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_categories      before insert or update or delete on categories      for each row execute function guard_closed_edition();
create trigger guard_category_teams  before insert or update or delete on category_teams  for each row execute function guard_closed_edition();
create trigger guard_matches         before insert or update or delete on matches         for each row execute function guard_closed_edition();
create trigger guard_match_events    before insert or update or delete on match_events    for each row execute function guard_closed_edition();
create trigger guard_category_podium before insert or update or delete on category_podium for each row execute function guard_closed_edition();

-- Una edición finalizada solo puede reabrirla un administrador
create or replace function public.guard_edition_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'finalizado' and new.status <> 'finalizado' and not is_admin() then
    raise exception 'EDICION_CERRADA: solo un administrador puede reabrir una edición finalizada'
      using errcode = 'P0001';
  end if;
  if old.status = 'finalizado' and new.status = 'finalizado' and (new.name, new.year, new.start_date, new.end_date) is distinct from (old.name, old.year, old.start_date, old.end_date) then
    raise exception 'EDICION_CERRADA: la edición está finalizada' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_edition_status before update on editions for each row execute function guard_edition_status();

-- Sello de auditoría
create or replace function public.touch_match() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.scheduled_at is distinct from old.scheduled_at then
    new.reminder_sent := false;
  end if;
  return new;
end $$;
create trigger touch_match before update on matches for each row execute function touch_match();

-- Al finalizar un partido se encola la notificación de resultado
create or replace function public.queue_result_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h text; a text;
begin
  if new.status = 'finalizado' and (old.status is distinct from 'finalizado'
      or new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score) then
    select name into h from teams where id = new.home_team_id;
    select name into a from teams where id = new.away_team_id;
    insert into notification_queue (kind, title, body, url, team_ids)
    values ('resultado', 'Resultado final',
            format('%s %s - %s %s', h, new.home_score, new.away_score, a),
            '/partido?id=' || new.id,
            array_remove(array[new.home_team_id, new.away_team_id], null));
  end if;
  return new;
end $$;
create trigger queue_result after update on matches for each row execute function queue_result_notification();

-- Recordatorios: partidos que empiezan en la próxima hora (lo llama pg_cron)
create or replace function public.queue_match_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    update matches m set reminder_sent = true
    where m.status = 'programado' and not m.reminder_sent
      and m.scheduled_at between now() and now() + interval '60 minutes'
      and m.home_team_id is not null and m.away_team_id is not null
    returning m.*
  )
  insert into notification_queue (kind, title, body, url, team_ids)
  select 'recordatorio', 'Partido pronto',
         format('%s vs %s · %s', h.name, a.name, to_char(d.scheduled_at at time zone 'America/Bogota', 'HH12:MI AM')),
         '/partido?id=' || d.id, array[d.home_team_id, d.away_team_id]
  from due d join teams h on h.id = d.home_team_id join teams a on a.id = d.away_team_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- RPC: suscripción push anónima (sin login). No se expone la tabla.
-- =====================================================================
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_teams uuid[] default '{}', p_veredas uuid[] default '{}', p_all boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then
    raise exception 'SUSCRIPCION_INVALIDA' using errcode = '22023';
  end if;
  if coalesce(array_length(p_teams, 1), 0) > 50 or coalesce(array_length(p_veredas, 1), 0) > 50 then
    raise exception 'DEMASIADOS_FAVORITOS' using errcode = '22023';
  end if;
  insert into push_subscriptions (endpoint, p256dh, auth_key, favorite_team_ids, favorite_vereda_ids, notify_all)
  values (p_endpoint, p_p256dh, p_auth, p_teams, p_veredas, p_all)
  on conflict (endpoint) do update
    set favorite_team_ids = excluded.favorite_team_ids,
        favorite_vereda_ids = excluded.favorite_vereda_ids,
        notify_all = excluded.notify_all,
        last_seen = now()
    -- Solo quien conoce la clave auth puede modificar su suscripción
    where push_subscriptions.auth_key = excluded.auth_key;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text, p_auth text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and auth_key = p_auth
$$;

-- Aprobar planilla de un planillero: aplica marcador y eventos en una transacción
create or replace function public.approve_match_report(p_report uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r match_reports; ev jsonb;
begin
  if not is_organizer() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  select * into r from match_reports where id = p_report and status = 'pendiente' for update;
  if not found then
    raise exception 'PLANILLA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  update matches set
    home_score = (r.data->>'home_score')::int,
    away_score = (r.data->>'away_score')::int,
    home_penalties = nullif(r.data->>'home_penalties','')::int,
    away_penalties = nullif(r.data->>'away_penalties','')::int,
    status = 'finalizado'
  where id = r.match_id;
  delete from match_events where match_id = r.match_id;
  for ev in select * from jsonb_array_elements(coalesce(r.data->'events', '[]'::jsonb)) loop
    insert into match_events (match_id, team_id, player_id, type, minute)
    values (r.match_id, (ev->>'team_id')::uuid, nullif(ev->>'player_id','')::uuid,
            (ev->>'type')::event_type, nullif(ev->>'minute','')::int);
  end loop;
  update match_reports set status = 'aprobado', reviewed_by = auth.uid(), review_note = p_note where id = p_report;
end $$;

-- =====================================================================
-- Row Level Security
-- Regla general: lectura pública de datos deportivos; escritura solo personal.
-- =====================================================================
alter table profiles           enable row level security;
alter table sports             enable row level security;
alter table veredas            enable row level security;
alter table editions           enable row level security;
alter table categories         enable row level security;
alter table teams              enable row level security;
alter table players            enable row level security;
alter table category_teams     enable row level security;
alter table matches            enable row level security;
alter table match_events       enable row level security;
alter table match_reports      enable row level security;
alter table category_podium    enable row level security;
alter table notices            enable row level security;
alter table gallery_photos     enable row level security;
alter table push_subscriptions enable row level security;   -- sin políticas: solo vía RPC
alter table notification_queue enable row level security;   -- sin políticas: solo service role

-- Lectura pública
create policy pub_read on sports          for select using (true);
create policy pub_read on veredas         for select using (true);
create policy pub_read on editions        for select using (true);
create policy pub_read on categories      for select using (true);
create policy pub_read on teams           for select using (true);
create policy pub_read on players         for select using (active);
create policy pub_read on category_teams  for select using (true);
create policy pub_read on matches         for select using (true);
create policy pub_read on match_events    for select using (true);
create policy pub_read on category_podium for select using (true);
create policy pub_read on gallery_photos  for select using (true);
create policy pub_read on notices         for select
  using (active and starts_at <= now() and (ends_at is null or ends_at > now()) or is_organizer());

-- Organizador / admin: gestión completa
create policy org_write on sports          for all using (is_admin())     with check (is_admin());
create policy org_write on veredas         for all using (is_organizer()) with check (is_organizer());
create policy org_write on editions        for all using (is_organizer()) with check (is_organizer());
create policy org_write on categories      for all using (is_organizer()) with check (is_organizer());
create policy org_write on teams           for all using (is_organizer()) with check (is_organizer());
create policy org_write on category_teams  for all using (is_organizer()) with check (is_organizer());
create policy org_write on matches         for all using (is_organizer()) with check (is_organizer());
create policy org_write on match_events    for all using (is_organizer()) with check (is_organizer());
create policy org_write on category_podium for all using (is_organizer()) with check (is_organizer());
create policy org_write on notices         for all using (is_organizer()) with check (is_organizer());
create policy org_write on gallery_photos  for all using (is_organizer()) with check (is_organizer());
create policy org_all_players on players   for all using (is_organizer()) with check (is_organizer());
create policy org_read_inactive on players for select using (is_organizer());

-- Delegado: administra la plantilla de su propio equipo
create policy delegate_players on players for all
  using (team_id = my_team()) with check (team_id = my_team());
create policy delegate_read_inactive on players for select using (team_id = my_team());

-- Planillero: envía planillas (pendientes de verificación) y ve las suyas
create policy report_insert on match_reports for insert
  with check (my_role() in ('planillero','organizador','admin') and submitted_by = auth.uid() and status = 'pendiente');
create policy report_read on match_reports for select
  using (submitted_by = auth.uid() or is_organizer());
create policy report_review on match_reports for update
  using (is_organizer()) with check (is_organizer());

-- Perfiles: cada quien ve el suyo; el admin gestiona roles
create policy profile_self on profiles for select using (id = auth.uid() or is_organizer());
create policy profile_admin on profiles for all using (is_admin()) with check (is_admin());

-- Impedir que alguien se asigne un rol a sí mismo
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.role is distinct from old.role or new.team_id is distinct from old.team_id)
     and not is_admin() and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'NO_AUTORIZADO: solo un administrador asigna roles' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_profile_role before insert or update on profiles for each row execute function guard_profile_role();

-- Al crear un usuario en Auth se crea su perfil con el rol mínimo
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id,
          left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                        'Usuario ' || split_part(coalesce(new.email, 'nuevo'), '@', 1)), 80),
          'delegado');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Permisos de ejecución de RPC
revoke all on function public.save_push_subscription(text,text,text,uuid[],uuid[],boolean) from public;
grant execute on function public.save_push_subscription(text,text,text,uuid[],uuid[],boolean) to anon, authenticated;
revoke all on function public.delete_push_subscription(text,text) from public;
grant execute on function public.delete_push_subscription(text,text) to anon, authenticated;
revoke all on function public.approve_match_report(uuid,text) from public;
grant execute on function public.approve_match_report(uuid,text) to authenticated;
revoke all on function public.queue_match_reminders() from public, anon, authenticated;

-- Datos iniciales
insert into sports (id, name, score_label) values
  ('microfutbol', 'Microfútbol', 'goles'),
  ('baloncesto',  'Baloncesto',  'puntos');
insert into veredas (name) values ('Los Arrayanes');
