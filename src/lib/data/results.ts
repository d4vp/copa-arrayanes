import { nextKnockoutRound } from "../domain/fixtures";
import type { EventType, Match } from "../types";
import type { Snapshot } from "./backend";
import type { useStore } from "./store";

type Store = ReturnType<typeof useStore>;
export interface ResultPayload { home_score: number; away_score: number; home_penalties: number | null; away_penalties: number | null }
export interface ResultEvent { team_id: string; player_id: string | null; type: EventType; minute: number | null }

/**
 * Guarda el resultado de un partido. Lo usan el formulario manual y el asistente.
 *  - Organizador/admin: publica el marcador, reemplaza la planilla y avanza la llave.
 *  - Planillero: envía una planilla pendiente de verificación.
 * Devuelve las fases creadas automáticamente (p. ej. "final") y si quedó en cola sin conexión.
 */
export async function saveMatchResult(store: Store, data: Snapshot, m: Match, payload: ResultPayload, events: ResultEvent[], isOrganizer: boolean) {
  if (!isOrganizer) {
    const r = await store.insert("match_reports", [{ match_id: m.id, data: { ...payload, events }, status: "pendiente" }], "Planilla");
    return { queued: r === "en_cola", created: [] as Match["stage"][] };
  }
  const r = await store.update("matches", { id: m.id }, { ...payload, status: "finalizado" }, "Resultado");
  await store.remove("match_events", { match_id: m.id }, "Planilla");
  if (events.length) await store.insert("match_events", events.map((e) => ({ ...e, match_id: m.id })), "Planilla");
  const created: Match["stage"][] = [];
  if (!["liga", "grupo"].includes(m.stage)) {
    const cat = data.categories.find((c) => c.id === m.category_id);
    if (cat) {
      const all = data.matches.filter((x) => x.category_id === m.category_id).map((x) => (x.id === m.id ? { ...x, ...payload, status: "finalizado" as const } : x));
      const next = nextKnockoutRound(cat.id, all, cat.third_place);
      if (next.length) { await store.insert("matches", next, "Siguiente ronda"); created.push(...next.map((x) => x.stage)); }
    }
  }
  return { queued: r === "en_cola", created };
}

/** Goles que suma cada equipo según la planilla (los autogoles cuentan para el rival). */
export function goalsFromEvents(events: Array<Pick<ResultEvent, "team_id" | "type">>, teamId: string | null) {
  return events.filter((e) => (e.type === "gol" && e.team_id === teamId) || (e.type === "autogol" && e.team_id !== teamId)).length;
}
