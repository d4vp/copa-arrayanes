-- Tareas programadas (gratis en Supabase).
-- Requiere activar las extensiones pg_cron y pg_net: Dashboard → Database → Extensions.
-- Reemplaza <PROJECT_REF> y guarda el secreto CRON_SECRET en Vault antes de ejecutar:
--   select vault.create_secret('<el mismo valor de CRON_SECRET de la Edge Function>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cada 5 minutos: encolar recordatorios y disparar el envío de notificaciones.
select cron.schedule('copa-notificaciones', '*/5 * * * *', $$
  select public.queue_match_reminders();
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  )
  where exists (select 1 from public.notification_queue where sent_at is null and attempts < 5);
$$);

-- Limpieza semanal de la cola ya enviada
select cron.schedule('copa-limpieza', '0 4 * * 0', $$
  delete from public.notification_queue where sent_at < now() - interval '30 days';
  delete from public.push_subscriptions where last_seen < now() - interval '180 days';
$$);
