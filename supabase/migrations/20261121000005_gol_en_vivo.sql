-- Notificación push de GOL durante el partido en vivo (además del resultado final).
create or replace function public.queue_result_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h text; a text; scorer uuid;
begin
  select name into h from teams where id = new.home_team_id;
  select name into a from teams where id = new.away_team_id;

  -- Gol en vivo: el marcador sube mientras el partido está en juego
  if new.status = 'en_juego' and old.status = 'en_juego' then
    if coalesce(new.home_score, 0) > coalesce(old.home_score, 0) then scorer := new.home_team_id;
    elsif coalesce(new.away_score, 0) > coalesce(old.away_score, 0) then scorer := new.away_team_id;
    end if;
    if scorer is not null then
      insert into notification_queue (kind, title, body, url, team_ids)
      values ('gol', '⚽ ¡Gol de ' || (select name from teams where id = scorer) || '!',
              format('%s %s - %s %s', h, new.home_score, new.away_score, a),
              '/partido?id=' || new.id, array_remove(array[new.home_team_id, new.away_team_id], null));
    end if;
  end if;

  -- Inicio del partido
  if new.status = 'en_juego' and old.status is distinct from 'en_juego' then
    insert into notification_queue (kind, title, body, url, team_ids)
    values ('inicio', 'Empezó el partido', format('%s vs %s', h, a), '/partido?id=' || new.id,
            array_remove(array[new.home_team_id, new.away_team_id], null));
  end if;

  -- Resultado final
  if new.status = 'finalizado' and (old.status is distinct from 'finalizado'
      or new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score) then
    insert into notification_queue (kind, title, body, url, team_ids)
    values ('resultado', 'Resultado final', format('%s %s - %s %s', h, new.home_score, new.away_score, a),
            '/partido?id=' || new.id, array_remove(array[new.home_team_id, new.away_team_id], null));
  end if;
  return new;
end $$;
