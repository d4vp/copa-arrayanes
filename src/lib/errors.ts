/**
 * Manejo centralizado de errores.
 * Convierte cualquier fallo (red, HTTP, PostgreSQL, validación) en un AppError
 * con un mensaje claro en español y una acción sugerida (heurística 9 de Nielsen:
 * ayudar a reconocer, diagnosticar y recuperarse de errores).
 */

export type ErrorKind =
  | "validacion"      // 400 · datos inválidos
  | "no_autenticado"  // 401 · sesión vencida
  | "no_autorizado"   // 403 · sin permisos
  | "no_encontrado"   // 404
  | "conflicto"       // 409 · duplicado o en uso
  | "edicion_cerrada" // regla de negocio: historial protegido
  | "limite"          // 429 · demasiadas solicitudes
  | "servidor"        // 500+
  | "sin_conexion"    // red caída
  | "desconocido";

export class AppError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public status?: number,
    public hint?: string,
    public cause?: unknown,
    /** Código específico opcional, p. ej. "no_configurado" */
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
  /** Se puede reintentar automáticamente más tarde */
  get retryable() {
    return this.kind === "sin_conexion" || this.kind === "servidor" || this.kind === "limite";
  }
}

const MESSAGES: Record<ErrorKind, { message: string; hint?: string; status?: number }> = {
  validacion: { status: 400, message: "Hay datos que no son válidos.", hint: "Revisa los campos marcados." },
  no_autenticado: { status: 401, message: "Tu sesión terminó.", hint: "Vuelve a iniciar sesión." },
  no_autorizado: { status: 403, message: "No tienes permiso para hacer esto.", hint: "Pide acceso a un administrador." },
  no_encontrado: { status: 404, message: "No encontramos lo que buscas.", hint: "Puede que haya sido eliminado." },
  conflicto: { status: 409, message: "Ya existe un registro igual o está en uso.", hint: "Cambia el nombre o revisa los datos relacionados." },
  edicion_cerrada: { message: "Esta edición ya terminó y su historial está protegido.", hint: "Solo un administrador puede reabrirla." },
  limite: { status: 429, message: "Demasiadas solicitudes seguidas.", hint: "Espera un momento e inténtalo de nuevo." },
  servidor: { status: 500, message: "El servidor tuvo un problema.", hint: "No es tu culpa. Inténtalo de nuevo en unos minutos." },
  sin_conexion: { message: "Sin conexión a internet.", hint: "Tus cambios se guardan y se enviarán al recuperar la señal." },
  desconocido: { message: "Ocurrió un error inesperado.", hint: "Inténtalo de nuevo." },
};

export function appError(kind: ErrorKind, override?: string, cause?: unknown): AppError {
  const base = MESSAGES[kind];
  return new AppError(kind, override ?? base.message, base.status, base.hint, cause);
}

interface PgLike { code?: string; message?: string; details?: string; hint?: string; status?: number }

/** Traduce errores de PostgreSQL/PostgREST/Supabase/fetch a AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (typeof navigator !== "undefined" && navigator.onLine === false) return appError("sin_conexion", undefined, err);
  if (err instanceof TypeError && /fetch|network|Failed to fetch|Load failed/i.test(err.message)) {
    return appError("sin_conexion", undefined, err);
  }

  const e = (err ?? {}) as PgLike;
  const msg = e.message ?? String(err);

  // supabase-js envuelve los fallos de red como { message: "TypeError: Failed to fetch", status: 0 }
  if (/Failed to fetch|NetworkError|Load failed|network error/i.test(msg) || (e.status === 0 && !e.code)) {
    return appError("sin_conexion", undefined, err);
  }
  if (/EDICION_CERRADA/.test(msg)) return appError("edicion_cerrada", msg.split(":").slice(1).join(":").trim() || undefined, err);
  if (/NO_AUTORIZADO/.test(msg)) return appError("no_autorizado", undefined, err);
  if (/PLANILLA_NO_ENCONTRADA/.test(msg)) return appError("no_encontrado", "La planilla ya fue revisada o no existe.", err);
  if (/Invalid login credentials/i.test(msg)) return appError("validacion", "Correo o contraseña incorrectos.", err);
  if (/Email not confirmed/i.test(msg)) return appError("validacion", "Debes confirmar tu correo antes de entrar.", err);

  switch (e.code) {
    case "23505": return appError("conflicto", "Ya existe un registro con ese nombre.", err);
    case "23503": return appError("conflicto", "No se puede completar: hay datos relacionados (por ejemplo, partidos o jugadores).", err);
    case "23514":
    case "22P02":
    case "22023":
    case "23502": return appError("validacion", undefined, err);
    case "42501": return appError("no_autorizado", undefined, err);
    case "PGRST116": return appError("no_encontrado", undefined, err);
    case "PGRST301":
    case "PGRST302": return appError("no_autenticado", undefined, err);
  }

  const status = e.status;
  if (status) {
    if (status === 400 || status === 422) return appError("validacion", undefined, err);
    if (status === 401) return appError("no_autenticado", undefined, err);
    if (status === 403) return appError("no_autorizado", undefined, err);
    if (status === 404) return appError("no_encontrado", undefined, err);
    if (status === 409) return appError("conflicto", undefined, err);
    if (status === 429) return appError("limite", undefined, err);
    if (status >= 500) return appError("servidor", undefined, err);
  }

  return appError("desconocido", undefined, err);
}

/** Registro discreto en consola (sin datos personales). */
export function logError(context: string, err: unknown) {
  const e = toAppError(err);
  console.error(`[copa] ${context}: ${e.kind}`, e.cause ?? e);
}
