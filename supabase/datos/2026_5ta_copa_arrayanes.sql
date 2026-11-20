-- =====================================================================
-- 5ta Copa Arrayanes · Microfútbol 2026 (campeonato en curso)
-- Fuente: https://sites.google.com/view/5tacopaarrayanes2026
--   (afiches de "Equipos", "Partidos programados" y "Partidos finalizados")
-- Carga: npx supabase db query --remote -f supabase/datos/2026_5ta_copa_arrayanes.sql
-- Es seguro repetirlo: si la edición ya existe, no hace nada.
--
-- Decisiones tomadas donde los afiches se contradicen:
--  * 12-sep Grupo E: la programación decía "Palmeiras", el resultado es de Racing Sport.
--  * 26-sep: el afiche de resultados rotula Chelsea-Racing y N. Integración-Santos como
--    "Grupo G" y la programación como "E"; se usa el grupo de la lista oficial de equipos
--    (Chelsea/Racing → E, N. Integración/Santos → G). Yungachala-Micreras → Femenino C.
--  * 13-sep La Masía vs Bayer J.C. estaba programado pero no tiene resultado publicado:
--    queda "aplazado".
--  * Local/visitante según el afiche de programación. Hora de Colombia (UTC-5).
-- =====================================================================
do $$
declare
  ed uuid; masc uuid; fem uuid;
  venue constant text := 'Polideportivo Arrayanes';
  r record;
begin
  if exists (select 1 from editions where name = '5ta Copa Arrayanes 2026') then
    raise notice 'La edición ya existe: no se carga nada.';
    return;
  end if;

  insert into editions (name, year, start_date, status)
  values ('5ta Copa Arrayanes 2026', 2026, '2026-09-12', 'en_desarrollo') returning id into ed;

  insert into categories (edition_id, sport_id, branch, name, format, group_count, knockout_size, third_place)
  values (ed, 'microfutbol', 'masculino', 'Microfútbol Masculino', 'grupos', 7, 8, true) returning id into masc;
  insert into categories (edition_id, sport_id, branch, name, format, group_count, knockout_size, third_place)
  values (ed, 'microfutbol', 'femenino', 'Microfútbol Femenino', 'grupos', 3, 4, true) returning id into fem;

  -- Equipos: (nombre, sigla, forma, color1, color2, rama, grupo)
  create temp table _eq (name text, short text, shape text, c1 text, c2 text, cat text, grp text) on commit drop;
  insert into _eq values
    -- Masculino
    ('River Sport',          'RIV', 'escudo',   '#b91c1c', '#ffffff', 'M', 'A'),
    ('Chaquaipe Centro',     'CHA', 'escudo',   '#1d4ed8', '#ffffff', 'M', 'A'),
    ('Team G.S.',            'TGS', 'escudo',   '#1e3a8a', '#e0f2fe', 'M', 'A'),
    ('Combo F.C.',           'COM', 'escudo',   '#166534', '#ffffff', 'M', 'A'),
    ('Inter F.C.',           'INT', 'circulo',  '#0f172a', '#3b82f6', 'M', 'B'),
    ('Deportivo La Soledad', 'DLS', 'escudo',   '#1e40af', '#dc2626', 'M', 'B'),
    ('Élite F.C.',           'ELI', 'escudo',   '#0f172a', '#facc15', 'M', 'B'),
    ('Golden F.C.',          'GOL', 'escudo',   '#1c1917', '#f59e0b', 'M', 'B'),
    ('Galácticos',           'GAL', 'escudo',   '#0f172a', '#eab308', 'M', 'C'),
    ('Arrayanes F.C.',       'ARR', 'escudo',   '#15803d', '#ffffff', 'M', 'C'),
    ('Muesmueran Bajo',      'MUE', 'escudo',   '#14532d', '#ffffff', 'M', 'C'),
    ('Banfield',             'BAN', 'escudo',   '#15803d', '#ffffff', 'M', 'C'),
    ('Alcones F.C.',         'ALC', 'escudo',   '#7c2d12', '#f97316', 'M', 'D'),
    ('La Masía',             'MAS', 'escudo',   '#1e3a8a', '#dc2626', 'M', 'D'),
    ('P.S.D.',               'PSD', 'escudo',   '#dc2626', '#0f172a', 'M', 'D'),
    ('Bayer J.C.',           'BAY', 'circulo',  '#dc2626', '#1d4ed8', 'M', 'D'),
    ('Chelsea Mirador',      'CHE', 'circulo',  '#1d4ed8', '#ffffff', 'M', 'E'),
    ('Racing Sport',         'RAC', 'escudo',   '#38bdf8', '#ffffff', 'M', 'E'),
    ('La Banda del Poche',   'BDP', 'circulo',  '#0f172a', '#facc15', 'M', 'E'),
    ('Invictus',             'INV', 'escudo',   '#292524', '#f59e0b', 'M', 'E'),
    ('Inter-La Cumbre',      'ILC', 'escudo',   '#1d4ed8', '#15803d', 'M', 'F'),
    ('F.C. Santander',       'SAN', 'escudo',   '#dc2626', '#0f172a', 'M', 'F'),
    ('Guitungal',            'GUI', 'hexagono', '#78350f', '#f97316', 'M', 'F'),
    ('BC Ingeniería',        'BCI', 'escudo',   '#1d4ed8', '#0f172a', 'M', 'F'),
    ('Calzado Maryuri',      'CAM', 'escudo',   '#be185d', '#ffffff', 'M', 'G'),
    ('Nueva Integración',    'NIN', 'escudo',   '#dc2626', '#0f172a', 'M', 'G'),
    ('Santos',               'STS', 'escudo',   '#166534', '#ffffff', 'M', 'G'),
    ('Alianza Club FC',      'ALI', 'escudo',   '#334155', '#38bdf8', 'M', 'G'),
    -- Femenino
    ('AIACN',                'AIA', 'circulo',  '#b91c1c', '#ffffff', 'F', 'A'),
    ('S.F. de Payán',        'SFP', 'escudo',   '#0f172a', '#f59e0b', 'F', 'A'),
    ('Real Juventud',        'RJU', 'escudo',   '#1e3a8a', '#facc15', 'F', 'A'),
    ('Arrayanes F.C. Femenino', 'ARF', 'escudo', '#15803d', '#ffffff', 'F', 'A'),
    ('River F.C.',           'RFC', 'escudo',   '#b91c1c', '#ffffff', 'F', 'B'),
    ('Daykelp',              'DAY', 'escudo',   '#7c3aed', '#f59e0b', 'F', 'B'),
    ('Panteras',             'PAN', 'escudo',   '#0f172a', '#dc2626', 'F', 'B'),
    ('Scorpions',            'SCO', 'diamante', '#7f1d1d', '#ffffff', 'F', 'B'),
    ('Betas',                'BET', 'escudo',   '#be185d', '#0f172a', 'F', 'C'),
    ('Micreras F.C.',        'MIC', 'escudo',   '#be185d', '#0f172a', 'F', 'C'),
    ('Black Power',          'BPW', 'escudo',   '#0f172a', '#dc2626', 'F', 'C'),
    ('S.F. de Yungachala',   'SFY', 'escudo',   '#dc2626', '#ffffff', 'F', 'C');

  insert into teams (name, short_name, crest_shape, color_primary, color_secondary)
  select name, short, shape, c1, c2 from _eq
  on conflict (name) do nothing;

  insert into category_teams (category_id, team_id, group_label)
  select case e.cat when 'M' then masc else fem end, t.id, e.grp
  from _eq e join teams t on t.name = e.name;

  -- Partidos: (rama, grupo, fecha, hora local, local, visitante, goles L, goles V)
  create temp table _pa (cat text, grp text, rnd int, at timestamptz, home text, away text, hs int, aws int) on commit drop;
  insert into _pa values
    -- Fecha 1
    ('F','B',1,'2026-09-12 18:00-05','Scorpions','Panteras',1,1),
    ('M','E',1,'2026-09-12 19:00-05','Racing Sport','La Banda del Poche',1,8),
    ('M','B',1,'2026-09-12 20:00-05','Inter F.C.','Deportivo La Soledad',2,2),
    ('M','C',1,'2026-09-12 21:00-05','Arrayanes F.C.','Banfield',3,12),
    ('F','A',1,'2026-09-13 17:30-05','S.F. de Payán','Real Juventud',2,2),
    ('F','A',1,'2026-09-13 18:30-05','Arrayanes F.C. Femenino','AIACN',0,4),
    ('M','D',1,'2026-09-13 19:30-05','Alcones F.C.','P.S.D.',7,5),
    ('M','D',1,'2026-09-13 20:30-05','La Masía','Bayer J.C.',null,null),
    -- Fecha 2
    ('M','F',2,'2026-09-19 18:00-05','Guitungal','Inter-La Cumbre',4,0),
    ('M','D',2,'2026-09-19 19:00-05','Alcones F.C.','Bayer J.C.',2,6),
    ('M','C',2,'2026-09-19 20:00-05','Muesmueran Bajo','Banfield',2,3),
    ('M','E',2,'2026-09-19 21:00-05','Chelsea Mirador','Invictus',4,1),
    ('F','C',2,'2026-09-20 17:30-05','Black Power','Betas',6,8),
    ('F','B',2,'2026-09-20 18:30-05','Daykelp','Scorpions',1,6),
    ('M','D',2,'2026-09-20 19:30-05','La Masía','P.S.D.',6,5),
    ('M','A',2,'2026-09-20 20:30-05','Team G.S.','Combo F.C.',2,2),
    -- Fecha 3
    ('M','B',3,'2026-09-25 18:00-05','Deportivo La Soledad','Golden F.C.',7,4),
    ('M','F',3,'2026-09-25 19:00-05','F.C. Santander','BC Ingeniería',10,5),
    ('M','A',3,'2026-09-25 20:00-05','River Sport','Team G.S.',3,3),
    ('M','B',3,'2026-09-25 21:00-05','Inter F.C.','Élite F.C.',4,5),
    ('F','A',3,'2026-09-26 17:00-05','AIACN','S.F. de Payán',1,3),
    ('F','C',3,'2026-09-26 18:00-05','S.F. de Yungachala','Micreras F.C.',4,8),
    ('M','E',3,'2026-09-26 19:00-05','Chelsea Mirador','Racing Sport',8,5),
    ('M','C',3,'2026-09-26 20:00-05','Arrayanes F.C.','Galácticos',4,4),
    ('M','G',3,'2026-09-26 21:00-05','Nueva Integración','Santos',4,10);

  insert into matches (category_id, stage, group_label, round, home_team_id, away_team_id,
                       scheduled_at, venue, status, home_score, away_score, notes)
  select case p.cat when 'M' then masc else fem end, 'grupo', p.grp, p.rnd, h.id, a.id,
         p.at, venue,
         (case when p.hs is null then 'aplazado' else 'finalizado' end)::match_status,
         p.hs, p.aws,
         case when p.hs is null then 'Sin resultado publicado por la organización' end
  from _pa p join teams h on h.name = p.home join teams a on a.name = p.away;

  -- Comprobación: todo partido debe haber encontrado sus dos equipos
  if (select count(*) from matches m join categories c on c.id = m.category_id where c.edition_id = ed) <> (select count(*) from _pa) then
    raise exception 'Hay partidos con nombres de equipo que no coinciden';
  end if;
end $$;
