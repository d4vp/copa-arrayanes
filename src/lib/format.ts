const TZ = "America/Bogota";

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  if (!iso) return "Por definir";
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, ...opts }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "Hoy", "Mañana", "Ayer" o fecha corta: más fácil de reconocer que una fecha. */
export function relativeDay(iso: string | null | undefined) {
  if (!iso) return "Sin fecha";
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const today = new Date();
  const k = key(new Date(iso));
  const diff = Math.round((Date.parse(k) - Date.parse(key(today))) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return fmtDate(iso);
}

export function dayKey(iso: string | null | undefined) {
  if (!iso) return "sin-fecha";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

export function timeAgo(d: Date | null) {
  if (!d) return "nunca";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Convierte valor de <input type="datetime-local"> (hora Colombia) a ISO UTC. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  return new Date(`${v}:00-05:00`).toISOString();
}

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export const BRANCH_LABEL = { masculino: "Masculino", femenino: "Femenino", mixto: "Mixto", veteranos: "Veteranos" } as const;
export const EDITION_STATUS_LABEL = { planificacion: "Planificación", inscripcion: "Inscripciones", en_desarrollo: "En juego", finalizado: "Finalizada" } as const;
export const MATCH_STATUS_LABEL = { programado: "Programado", en_juego: "En juego", finalizado: "Final", aplazado: "Aplazado", cancelado: "Cancelado" } as const;
