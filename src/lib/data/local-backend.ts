import { get, set } from "idb-keyval";
import { localParse, validateRequest, type AssistantRequest } from "@shared/asistente";
import { appError } from "../errors";
import type { EditionStatus, MatchReport, Profile, StaffRole, TableName } from "../types";
import { type Backend, type Match, PRIMARY_KEYS, type Row, rowMatches } from "./backend";
import { buildSeed } from "./seed";

type DB = { [K in TableName]: Row<K>[] };
const KEY = "copa-local-db-v1";
const SESSION_KEY = "copa-local-session";

/** Usuarios de demostración (solo modo local). Contraseña: demo */
export const DEMO_USERS: Record<string, { role: StaffRole; name: string }> = {
  "admin@demo.co": { role: "admin", name: "Administración" },
  "organizador@demo.co": { role: "organizador", name: "Comité organizador" },
  "planillero@demo.co": { role: "planillero", name: "Planillero de turno" },
  "delegado@demo.co": { role: "delegado", name: "Delegado Halcones" },
};

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

const DEFAULTS: Partial<Record<TableName, () => Record<string, unknown>>> = {
  editions: () => ({ status: "planificacion", start_date: null, end_date: null, based_on: null }),
  categories: () => ({ format: "grupos", group_count: 1, knockout_size: 4, third_place: true, points_win: 3, points_draw: 1, points_loss: 0, tiebreakers: ["puntos", "diferencia", "juego_limpio", "goles_favor"] }),
  teams: () => ({ short_name: null, vereda_id: null, crest_shape: "escudo", color_primary: "#1d4ed8", color_secondary: "#ffffff", crest_url: null }),
  players: () => ({ number: null, active: true }),
  category_teams: () => ({ group_label: null }),
  matches: () => ({ group_label: null, round: 1, bracket_slot: null, scheduled_at: null, venue: null, status: "programado", home_score: null, away_score: null, home_penalties: null, away_penalties: null, notes: null }),
  match_events: () => ({ player_id: null, minute: null }),
  match_reports: () => ({ status: "pendiente", review_note: null }),
  notices: () => ({ body: null, kind: "comunidad", starts_at: now(), ends_at: null, active: true }),
  gallery_photos: () => ({ caption: null }),
};

/**
 * Backend de demostración: replica en el navegador las reglas clave del servidor
 * (permisos por rol, edición cerrada, nombres únicos) para probar sin cuentas.
 */
export class LocalBackend implements Backend {
  readonly mode = "local" as const;
  private db: DB | null = null;
  private listeners = new Set<() => void>();
  private authListeners = new Set<() => void>();

  private async load(): Promise<DB> {
    if (this.db) return this.db;
    let db: DB | undefined;
    try { db = await get<DB>(KEY); } catch { /* almacenamiento bloqueado */ }
    this.db = db ?? (buildSeed() as DB);
    if (!db) await this.save();
    return this.db;
  }

  private async save() {
    try { await set(KEY, this.db); } catch { /* modo privado: solo memoria */ }
  }

  async reset() {
    this.db = buildSeed() as DB;
    await this.save();
    this.listeners.forEach((l) => l());
  }

  private session(): Profile | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch { return null; }
  }

  private requireRole(...roles: StaffRole[]) {
    const p = this.session();
    if (!p) throw appError("no_autenticado");
    if (!roles.includes(p.role)) throw appError("no_autorizado");
    return p;
  }

  private editionStatusFor(table: TableName, row: Record<string, unknown>, db: DB): EditionStatus | null {
    let categoryId: unknown = null;
    if (table === "categories") return db.editions.find((e) => e.id === row.edition_id)?.status ?? null;
    if (["matches", "category_teams", "category_podium"].includes(table)) categoryId = row.category_id;
    if (table === "match_events") categoryId = db.matches.find((m) => m.id === row.match_id)?.category_id;
    if (!categoryId) return null;
    const cat = db.categories.find((c) => c.id === categoryId);
    return db.editions.find((e) => e.id === cat?.edition_id)?.status ?? null;
  }

  private authorizeWrite(table: TableName, row: Record<string, unknown>, db: DB) {
    if (table === "match_reports") return this.requireRole("planillero", "organizador", "admin");
    if (table === "players") {
      const p = this.requireRole("admin", "organizador", "delegado");
      if (p.role === "delegado" && row.team_id !== p.team_id) throw appError("no_autorizado", "Solo puedes editar los jugadores de tu equipo.");
      return p;
    }
    if (table === "profiles" || table === "sports") return this.requireRole("admin");
    const p = this.requireRole("admin", "organizador");
    if (this.editionStatusFor(table, row, db) === "finalizado") throw appError("edicion_cerrada");
    return p;
  }

  private checkUnique(table: TableName, row: Record<string, unknown>, db: DB, selfId?: unknown) {
    if (table === "teams" || table === "veredas") {
      const name = String(row.name ?? "").trim().toLowerCase();
      const list = db[table] as Array<{ id: string; name: string }>;
      if (list.some((r) => r.id !== selfId && r.name.trim().toLowerCase() === name)) {
        throw appError("conflicto", `Ya existe "${row.name}".`);
      }
    }
  }

  async selectAll<T extends TableName>(table: T): Promise<Row<T>[]> {
    const db = await this.load();
    if (table === "notices" && !this.session()) {
      const t = now();
      return db.notices.filter((n) => n.active && n.starts_at <= t && (!n.ends_at || n.ends_at > t)) as Row<T>[];
    }
    if ((table === "match_reports" || table === "profiles") && !this.session()) return [];
    return structuredClone(db[table]);
  }

  async insert<T extends TableName>(table: T, rows: Match<T>[]) {
    const db = await this.load();
    const list = db[table] as unknown as Record<string, unknown>[];
    for (const r of rows) {
      const row: Record<string, unknown> = { ...(DEFAULTS[table]?.() ?? {}), ...r };
      if (!PRIMARY_KEYS[table]) row.id ??= uuid();
      row.created_at ??= now();
      if (table === "matches") row.updated_at = now();
      if (table === "match_reports") row.submitted_by = this.session()?.id;
      this.authorizeWrite(table, row, db);
      this.checkUnique(table, row, db);
      const pk = PRIMARY_KEYS[table] ?? ["id"];
      if (list.some((x) => pk.every((k) => x[k] === row[k]))) throw appError("conflicto");
      list.push(row);
    }
    await this.commit();
  }

  async update<T extends TableName>(table: T, where: Match<T>, patch: Match<T>) {
    const db = await this.load();
    const list = db[table] as unknown as Record<string, unknown>[];
    const targets = list.filter((r) => rowMatches(r, where as Record<string, unknown>));
    if (targets.length === 0) throw appError("no_encontrado");
    for (const row of targets) {
      if (table === "editions" && row.status === "finalizado" && patch && (patch as Record<string, unknown>).status !== undefined
          && (patch as Record<string, unknown>).status !== "finalizado") {
        this.requireRole("admin");
      } else {
        this.authorizeWrite(table, row, db);
      }
      this.checkUnique(table, { ...row, ...patch }, db, row.id);
      Object.assign(row, patch);
      if (table === "matches") row.updated_at = now();
    }
    await this.commit();
  }

  async remove<T extends TableName>(table: T, where: Match<T>) {
    const db = await this.load();
    const list = db[table] as unknown as Record<string, unknown>[];
    const targets = list.filter((r) => rowMatches(r, where as Record<string, unknown>));
    for (const row of targets) this.authorizeWrite(table, row, db);
    // Integridad referencial básica
    if (table === "teams" && targets.some((t) => db.matches.some((m) => m.home_team_id === t.id || m.away_team_id === t.id))) {
      throw appError("conflicto", "El equipo tiene partidos registrados. No se puede eliminar.");
    }
    (db as Record<string, unknown>)[table] = list.filter((r) => !targets.includes(r));
    if (table === "matches") db.match_events = db.match_events.filter((e) => !targets.some((t) => t.id === e.match_id));
    if (table === "categories") {
      const ids = new Set(targets.map((t) => t.id));
      db.matches = db.matches.filter((m) => !ids.has(m.category_id));
      db.category_teams = db.category_teams.filter((c) => !ids.has(c.category_id));
    }
    await this.commit();
  }

  async rpc(name: string, args: Record<string, unknown>) {
    const db = await this.load();
    if (name === "approve_match_report") {
      const p = this.requireRole("admin", "organizador");
      const rep = db.match_reports.find((r) => r.id === args.p_report && r.status === "pendiente") as MatchReport | undefined;
      if (!rep) throw appError("no_encontrado", "La planilla ya fue revisada o no existe.");
      const m = db.matches.find((x) => x.id === rep.match_id);
      if (!m) throw appError("no_encontrado");
      if (this.editionStatusFor("matches", m as never, db) === "finalizado") throw appError("edicion_cerrada");
      Object.assign(m, { home_score: rep.data.home_score, away_score: rep.data.away_score,
        home_penalties: rep.data.home_penalties ?? null, away_penalties: rep.data.away_penalties ?? null,
        status: "finalizado", updated_at: now() });
      db.match_events = db.match_events.filter((e) => e.match_id !== m.id);
      for (const e of rep.data.events) db.match_events.push({ id: uuid(), match_id: m.id, created_at: now(), ...e, player_id: e.player_id ?? null, minute: e.minute ?? null });
      Object.assign(rep, { status: "aprobado", review_note: (args.p_note as string) ?? null, reviewed_by: p.id });
      await this.commit();
      return null;
    }
    if (name === "save_push_subscription" || name === "delete_push_subscription") return null; // sin servidor push en modo local
    throw appError("no_encontrado", `Función ${name} no disponible en modo local.`);
  }

  async uploadImage(_bucket: "escudos" | "galeria", file: Blob) {
    // En modo local la imagen se guarda como data URL (ya viene comprimida).
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(appError("validacion", "No se pudo leer la imagen."));
      fr.readAsDataURL(file);
    });
  }

  publicUrl(_bucket: "escudos" | "galeria", path: string) { return path; }

  /** Modo demostración: sin IA. Lee el dictado con el lector gratuito; las fotos necesitan la IA. */
  async assistant(req: AssistantRequest) {
    this.requireRole("admin", "organizador", "planillero");
    const invalid = validateRequest(req);
    if (invalid) throw appError("validacion", invalid);
    if (req.images?.length && !req.text?.trim()) {
      throw appError("validacion", "Leer fotos requiere el asistente con IA (se activa al conectar Supabase y OpenAI). En la demostración usa el dictado.");
    }
    await new Promise((r) => setTimeout(r, 400));
    return localParse(req.text ?? "", req.candidates);
  }

  async currentProfile() { return this.session(); }

  async signIn(email: string, password: string) {
    const user = DEMO_USERS[email.trim().toLowerCase()];
    if (!user || password !== "demo") throw appError("validacion", "Correo o contraseña incorrectos. En modo demostración usa, por ejemplo, organizador@demo.co / demo.");
    const db = await this.load();
    const profile: Profile = {
      id: `demo-${user.role}`, full_name: user.name, role: user.role,
      team_id: user.role === "delegado" ? db.teams[0]?.id ?? null : null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    this.authListeners.forEach((l) => l());
    return profile;
  }

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    this.authListeners.forEach((l) => l());
  }

  onAuthChange(cb: () => void) { this.authListeners.add(cb); return () => { this.authListeners.delete(cb); }; }
  async sendPasswordReset() { throw appError("validacion", "En modo demostración la contraseña siempre es: demo"); }
  onRemoteChange(cb: () => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }

  private async commit() {
    await this.save();
    this.listeners.forEach((l) => l());
  }
}
