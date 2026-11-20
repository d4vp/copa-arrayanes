// Supabase Edge Function: asistente de planilla con IA (OpenAI).
// Recibe dictado y/o fotos + partidos candidatos y devuelve resultados para REVISAR (no guarda nada).
//
// Secretos (Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY      clave de OpenAI (solo aquí, nunca en la app)
//   OPENAI_MODEL        opcional, por defecto "gpt-4o-mini"
//   AI_DAILY_LIMIT      opcional, consultas por persona al día (por defecto 40)
//   ALLOWED_ORIGIN      opcional, ej. https://copa-arrayanes.pages.dev
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { buildJsonSchema, buildMessages, sanitizeResult, validateRequest, type AssistantRequest } from "../_shared/asistente.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const DAILY = Number(Deno.env.get("AI_DAILY_LIMIT") ?? 40);
const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "metodo_no_permitido" });

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return reply(503, { error: "no_configurado", message: "El asistente con IA no está configurado." });

  // 1. Sesión y rol: solo personal que registra partidos
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return reply(401, { error: "no_autenticado" });
  const admin = createClient(URL, SERVICE);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", u.user.id).single();
  if (!profile || !["admin", "organizador", "planillero"].includes(profile.role)) return reply(403, { error: "no_autorizado" });

  // 2. Límite diario por persona (controla el gasto)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", u.user.id).gte("created_at", since);
  if ((count ?? 0) >= DAILY) return reply(429, { error: "limite", message: `Alcanzaste el límite de ${DAILY} consultas en 24 horas.` });

  // 3. Validar solicitud
  let body: AssistantRequest;
  try { body = await req.json(); } catch { return reply(400, { error: "validacion", message: "Solicitud no válida." }); }
  const invalid = validateRequest(body);
  if (invalid) return reply(400, { error: "validacion", message: invalid });

  // 4. Llamar al modelo con salida estructurada estricta
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: buildMessages(body),
        response_format: { type: "json_schema", json_schema: { name: "resultados_jornada", strict: true, schema: buildJsonSchema(body.candidates) } },
      }),
    });
  } catch (e) {
    console.error("openai red", e);
    return reply(502, { error: "servidor", message: "No se pudo contactar al asistente. Intenta de nuevo." });
  }

  const out = await res.json().catch(() => null);
  await admin.from("ai_requests").insert({
    user_id: u.user.id, kind: body.images?.length ? "foto" : "dictado", model: MODEL,
    input_tokens: out?.usage?.prompt_tokens ?? null, output_tokens: out?.usage?.completion_tokens ?? null, ok: res.ok,
  });

  if (!res.ok) {
    console.error("openai", res.status, out?.error?.message);
    if (res.status === 429) return reply(429, { error: "limite", message: "El servicio de IA está saturado o sin crédito. Intenta más tarde o registra manualmente." });
    return reply(502, { error: "servidor", message: "El asistente no pudo procesar la solicitud." });
  }
  const msg = out?.choices?.[0]?.message;
  if (msg?.refusal) return reply(422, { error: "validacion", message: "El asistente no pudo leer esa información." });
  let parsed: unknown;
  try { parsed = JSON.parse(msg?.content ?? "{}"); } catch { return reply(502, { error: "servidor", message: "Respuesta inválida del asistente." }); }

  return reply(200, sanitizeResult(parsed, body.candidates, "ia"));
});
