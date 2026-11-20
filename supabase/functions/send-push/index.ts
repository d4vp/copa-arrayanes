// Supabase Edge Function: envía las notificaciones encoladas en notification_queue.
// La invoca pg_cron cada 5 minutos (ver migrations/*_cron.sql).
// Secretos (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:correo-del-comite), CRON_SECRET
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente (nunca van al cliente).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "no_autorizado" }), { status: 401 });
  }
  try {
    const { data: queue, error } = await sb.from("notification_queue").select("*")
      .is("sent_at", null).lt("attempts", 5).order("id").limit(50);
    if (error) throw error;
    if (!queue?.length) return Response.json({ sent: 0 });

    const { data: subs, error: e2 } = await sb.from("push_subscriptions").select("*");
    if (e2) throw e2;
    const { data: teams } = await sb.from("teams").select("id, vereda_id");
    const veredaOf = new Map((teams ?? []).map((t) => [t.id, t.vereda_id]));

    let sent = 0;
    const gone: string[] = [];
    for (const n of queue) {
      const veredas = new Set(n.team_ids.map((id: string) => veredaOf.get(id)).filter(Boolean));
      const targets = subs!.filter((s) => s.notify_all
        || s.favorite_team_ids.some((t: string) => n.team_ids.includes(t))
        || s.favorite_vereda_ids.some((v: string) => veredas.has(v)));
      const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: `${n.kind}-${n.url}` });
      const results = await Promise.allSettled(targets.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 6 * 3600, urgency: "normal" })));
      results.forEach((r, i) => {
        if (r.status === "fulfilled") sent++;
        else if ([404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) gone.push(targets[i].endpoint);
      });
      await sb.from("notification_queue").update({ sent_at: new Date().toISOString(), attempts: n.attempts + 1 }).eq("id", n.id);
    }
    // Suscripciones vencidas (el usuario desinstaló o revocó): se eliminan
    if (gone.length) await sb.from("push_subscriptions").delete().in("endpoint", gone);
    return Response.json({ sent, removed: gone.length });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "servidor" }), { status: 500 });
  }
});
