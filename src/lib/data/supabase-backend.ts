import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { AssistantRequest, AssistantResult } from "@shared/asistente";
import { appError, toAppError } from "../errors";
import type { Profile, TableName } from "../types";
import type { Backend, Match, Row } from "./backend";

/**
 * Backend de producción. Usa solo la clave pública (anon): toda la seguridad
 * la imponen las políticas RLS de PostgreSQL. Nunca incluir la service_role aquí.
 */
export class SupabaseBackend implements Backend {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "copa-auth" },
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }

  private async run<T>(p: PromiseLike<{ data: T; error: unknown; status?: number }>): Promise<T> {
    let res;
    try {
      res = await p;
    } catch (e) {
      throw toAppError(e);
    }
    if (res.error) {
      const err = res.error as Record<string, unknown>;
      throw toAppError({ ...err, status: err.status ?? res.status });
    }
    return res.data;
  }

  async selectAll<T extends TableName>(table: T): Promise<Row<T>[]> {
    // Volúmenes pequeños (cientos de filas): se pagina por seguridad.
    const out: Row<T>[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const data = await this.run(this.sb.from(table).select("*").range(from, from + page - 1));
      out.push(...((data ?? []) as Row<T>[]));
      if (!data || data.length < page) break;
    }
    return out;
  }

  async insert<T extends TableName>(table: T, rows: Match<T>[]) {
    // insert simple (no upsert): un planillero no tiene permiso de UPDATE.
    // Los ids se generan en el cliente, así un reintento sin conexión es idempotente (ver outbox).
    await this.run(this.sb.from(table).insert(rows as never[]));
  }

  private where<T extends TableName>(q: ReturnType<ReturnType<SupabaseClient["from"]>["update"]>, where: Match<T>) {
    let query = q;
    for (const [k, v] of Object.entries(where)) query = v === null ? query.is(k, null) : query.eq(k, v as never);
    return query;
  }

  async update<T extends TableName>(table: T, where: Match<T>, patch: Match<T>) {
    if (Object.keys(where).length === 0) throw appError("validacion", "Actualización sin filtro.");
    const data = await this.run(this.where(this.sb.from(table).update(patch as never), where).select());
    if (Array.isArray(data) && data.length === 0) {
      // RLS filtra en silencio: 0 filas = sin permiso o no existe.
      throw appError("no_autorizado", "No se pudo guardar: no tienes permiso o el registro ya no existe.");
    }
  }

  async remove<T extends TableName>(table: T, where: Match<T>) {
    if (Object.keys(where).length === 0) throw appError("validacion", "Eliminación sin filtro.");
    let q = this.sb.from(table).delete();
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v as never);
    await this.run(q);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    return this.run(this.sb.rpc(name, args));
  }

  async uploadImage(bucket: "escudos" | "galeria", file: Blob, path: string) {
    await this.run(this.sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" }));
    return this.publicUrl(bucket, path);
  }

  publicUrl(bucket: "escudos" | "galeria", path: string) {
    return this.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async currentProfile(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return null;
    const rows = await this.run(this.sb.from("profiles").select("*").eq("id", uid));
    return ((rows ?? [])[0] as Profile) ?? null;
  }

  async signIn(email: string, password: string) {
    await this.run(this.sb.auth.signInWithPassword({ email, password }) as never);
    const p = await this.currentProfile();
    if (!p) throw appError("no_autorizado", "Tu cuenta no tiene perfil asignado. Contacta al administrador.");
    return p;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  }

  async sendPasswordReset(email: string) {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/admin/clave` : undefined;
    await this.run(this.sb.auth.resetPasswordForEmail(email, { redirectTo }) as never);
  }

  onRemoteChange(cb: () => void) {
    // Realtime gratuito: 200 conexiones simultáneas. Solo tablas que cambian en partido.
    const ch = this.sb
      .channel("copa-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, cb)
      .subscribe();
    return () => { void this.sb.removeChannel(ch); };
  }

  async assistant(req: AssistantRequest): Promise<AssistantResult> {
    const { data, error } = await this.sb.functions.invoke("asistente-partido", { body: req });
    if (!error) return data as AssistantResult;
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const body = await res.json().catch(() => ({}));
      const e = toAppError({ status: res.status, message: body.message });
      if (body.message) e.message = body.message;
      e.code = typeof body.error === "string" ? body.error : undefined;
      throw e;
    }
    throw toAppError(error);
  }

  /** Para la página de nueva contraseña. */
  async updatePassword(password: string) {
    await this.run(this.sb.auth.updateUser({ password }) as never);
  }
}
