import type { AssistantRequest, AssistantResult } from "@shared/asistente";
import type { Profile, TableName, Tables } from "../types";

export type Row<T extends TableName> = Tables[T];
export type Match<T extends TableName> = Partial<Row<T>>;

/**
 * Contrato común para los dos orígenes de datos:
 *  - SupabaseBackend: producción (PostgreSQL + RLS).
 *  - LocalBackend: demostración/desarrollo sin cuentas, guarda en el navegador.
 * Toda la app trabaja contra esta interfaz.
 */
export interface Backend {
  readonly mode: "supabase" | "local";
  selectAll<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, rows: Match<T>[]): Promise<void>;
  update<T extends TableName>(table: T, where: Match<T>, patch: Match<T>): Promise<void>;
  remove<T extends TableName>(table: T, where: Match<T>): Promise<void>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  uploadImage(bucket: "escudos" | "galeria", file: Blob, path: string): Promise<string>;
  publicUrl(bucket: "escudos" | "galeria", path: string): string;

  // Autenticación (solo personal)
  currentProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;
  sendPasswordReset(email: string): Promise<void>;

  /** Asistente de planilla: dictado/fotos → resultados para revisar (no guarda nada). */
  assistant(req: AssistantRequest): Promise<AssistantResult>;

  /** Cambios en vivo (otros dispositivos). Devuelve función para cancelar. */
  onRemoteChange(cb: () => void): () => void;
}

/** Tablas públicas que se descargan completas y se guardan para uso sin conexión. */
export const PUBLIC_TABLES = [
  "sports", "veredas", "editions", "categories", "teams", "players", "category_teams",
  "matches", "match_events", "category_podium", "notices", "gallery_photos",
] as const satisfies readonly TableName[];

/** Tablas que solo ve el personal autenticado. */
export const STAFF_TABLES = ["match_reports", "profiles"] as const satisfies readonly TableName[];

export type PublicTable = (typeof PUBLIC_TABLES)[number];
export type StaffTable = (typeof STAFF_TABLES)[number];
export type Snapshot = { [K in PublicTable | StaffTable]: Row<K>[] };

export function emptySnapshot(): Snapshot {
  return Object.fromEntries([...PUBLIC_TABLES, ...STAFF_TABLES].map((t) => [t, []])) as unknown as Snapshot;
}

/** Clave primaria compuesta para tablas sin `id`. */
export const PRIMARY_KEYS: Partial<Record<TableName, string[]>> = {
  category_teams: ["category_id", "team_id"],
  category_podium: ["category_id", "position"],
};

export function rowMatches<T extends object>(row: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
