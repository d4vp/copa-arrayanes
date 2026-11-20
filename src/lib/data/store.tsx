"use client";

import { get, set } from "idb-keyval";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppError, logError, toAppError } from "../errors";
import type { Profile, TableName } from "../types";
import { type Backend, emptySnapshot, isSupabaseConfigured, type Match, PRIMARY_KEYS, PUBLIC_TABLES, type Row, rowMatches, type Snapshot, STAFF_TABLES } from "./backend";
import { LocalBackend } from "./local-backend";
import { SupabaseBackend } from "./supabase-backend";

// ---------- Backend único ----------
let backendInstance: Backend | null = null;
export function getBackend(): Backend {
  if (!backendInstance) {
    backendInstance = isSupabaseConfigured()
      ? new SupabaseBackend(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      : new LocalBackend();
  }
  return backendInstance;
}

// ---------- Cola de cambios sin conexión ----------
type Op =
  | { kind: "insert"; table: TableName; rows: Record<string, unknown>[] }
  | { kind: "update"; table: TableName; where: Record<string, unknown>; patch: Record<string, unknown> }
  | { kind: "remove"; table: TableName; where: Record<string, unknown> }
  | { kind: "rpc"; name: string; args: Record<string, unknown> };
type QueuedOp = Op & { qid: string; at: string; label: string };

const CACHE_KEY = "copa-cache-v1";
const OUTBOX_KEY = "copa-outbox-v1";

export type SyncStatus = "cargando" | "en_linea" | "sin_conexion" | "sincronizando";

interface StoreValue {
  data: Snapshot;
  ready: boolean;
  status: SyncStatus;
  lastSync: Date | null;
  pending: number;
  failed: Array<{ label: string; error: AppError }>;
  profile: Profile | null;
  mode: Backend["mode"];
  refresh: () => Promise<void>;
  /** Ejecuta un cambio. Sin conexión lo encola y lo aplica localmente. */
  mutate: (op: Op, label: string) => Promise<"guardado" | "en_cola">;
  insert: <T extends TableName>(table: T, rows: Match<T>[], label: string) => Promise<"guardado" | "en_cola">;
  update: <T extends TableName>(table: T, where: Match<T>, patch: Match<T>, label: string) => Promise<"guardado" | "en_cola">;
  remove: <T extends TableName>(table: T, where: Match<T>, label: string) => Promise<"guardado" | "en_cola">;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  dismissFailed: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore fuera de StoreProvider");
  return v;
}

/** Aplica una operación sobre la copia local (optimista). */
function applyLocal(snap: Snapshot, op: Op): Snapshot {
  if (op.kind === "rpc") return snap;
  const key = op.table as keyof Snapshot;
  if (!(key in snap)) return snap;
  const list = snap[key] as unknown as Record<string, unknown>[];
  const next = { ...snap };
  if (op.kind === "insert") {
    const pk = PRIMARY_KEYS[op.table] ?? ["id"];
    const rest = list.filter((r) => !op.rows.some((n) => pk.every((k) => n[k] === r[k])));
    (next as Record<string, unknown>)[key] = [...rest, ...op.rows];
  } else if (op.kind === "update") {
    (next as Record<string, unknown>)[key] = list.map((r) => (rowMatches(r, op.where) ? { ...r, ...op.patch } : r));
  } else {
    (next as Record<string, unknown>)[key] = list.filter((r) => !rowMatches(r, op.where));
  }
  return next;
}

async function runOp(b: Backend, op: Op) {
  switch (op.kind) {
    case "insert": return b.insert(op.table, op.rows as never);
    case "update": return b.update(op.table, op.where as never, op.patch as never);
    case "remove": return b.remove(op.table, op.where as never);
    case "rpc": return b.rpc(op.name, op.args);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const backend = getBackend();
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("cargando");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [outbox, setOutbox] = useState<QueuedOp[]>([]);
  const [failed, setFailed] = useState<Array<{ label: string; error: AppError }>>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const flushing = useRef(false);
  const outboxRef = useRef<QueuedOp[]>([]);
  outboxRef.current = outbox;

  const persistOutbox = useCallback(async (q: QueuedOp[]) => {
    setOutbox(q);
    try { await set(OUTBOX_KEY, q); } catch { /* sin almacenamiento */ }
  }, []);

  const fetchAll = useCallback(async (withStaff: boolean): Promise<Snapshot> => {
    const tables = withStaff ? [...PUBLIC_TABLES, ...STAFF_TABLES] : [...PUBLIC_TABLES];
    const results = await Promise.all(tables.map((t) => backend.selectAll(t)));
    const snap = emptySnapshot();
    tables.forEach((t, i) => { (snap as Record<string, unknown>)[t] = results[i]; });
    return snap;
  }, [backend]);

  const refresh = useCallback(async () => {
    try {
      const p = await backend.currentProfile().catch(() => null);
      setProfile(p);
      let snap = await fetchAll(Boolean(p));
      // Cambios aún en cola se superponen para no "desaparecer" de la pantalla
      for (const op of outboxRef.current) snap = applyLocal(snap, op);
      setData(snap);
      setLastSync(new Date());
      setStatus(outboxRef.current.length ? "sincronizando" : "en_linea");
      try { await set(CACHE_KEY, { at: Date.now(), snap: { ...snap, match_reports: [], profiles: [] } }); } catch { /* */ }
    } catch (err) {
      const e = toAppError(err);
      logError("refresh", e);
      const cached = await get<{ at: number; snap: Snapshot }>(CACHE_KEY).catch(() => undefined);
      if (cached) {
        let snap = cached.snap;
        for (const op of outboxRef.current) snap = applyLocal(snap, op);
        setData((cur) => (cur.editions.length ? cur : snap));
        setLastSync((cur) => cur ?? new Date(cached.at));
      }
      setStatus("sin_conexion");
    } finally {
      setReady(true);
    }
  }, [backend, fetchAll]);

  const flush = useCallback(async () => {
    if (flushing.current || outboxRef.current.length === 0) return;
    flushing.current = true;
    setStatus("sincronizando");
    let queue = [...outboxRef.current];
    try {
      while (queue.length) {
        const op = queue[0];
        try {
          await runOp(backend, op);
        } catch (err) {
          const e = toAppError(err);
          if (e.retryable) break; // seguimos sin conexión: se reintenta luego
          // Reintento de un insert que sí llegó al servidor: no es un fallo real
          if (!(op.kind === "insert" && e.kind === "conflicto")) setFailed((f) => [...f, { label: op.label, error: e }]);
        }
        queue = queue.slice(1);
        await persistOutbox(queue);
      }
    } finally {
      flushing.current = false;
      await refresh();
    }
  }, [backend, persistOutbox, refresh]);

  // Arranque
  useEffect(() => {
    let alive = true;
    (async () => {
      const q = (await get<QueuedOp[]>(OUTBOX_KEY).catch(() => undefined)) ?? [];
      if (!alive) return;
      outboxRef.current = q;
      setOutbox(q);
      await refresh();
      if (q.length && navigator.onLine) void flush();
    })();
    return () => { alive = false; };
  }, [refresh, flush]);

  // Conectividad, foco y tiempo real
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 600); };
    const online = () => { void flush().then(refresh); };
    const offline = () => setStatus("sin_conexion");
    const visible = () => { if (document.visibilityState === "visible") debounced(); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const offRemote = backend.onRemoteChange(debounced);
    const offAuth = backend.onAuthChange(debounced);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
      offRemote(); offAuth();
    };
  }, [backend, refresh, flush]);

  const mutate = useCallback(async (op: Op, label: string): Promise<"guardado" | "en_cola"> => {
    const enqueue = async () => {
      const q = [...outboxRef.current, { ...op, qid: crypto.randomUUID(), at: new Date().toISOString(), label }];
      outboxRef.current = q;
      await persistOutbox(q);
      setData((d) => applyLocal(d, op));
      setStatus("sin_conexion");
      return "en_cola" as const;
    };
    // Las RPC y el modo local requieren respuesta inmediata del servidor
    const canQueue = op.kind !== "rpc" && backend.mode === "supabase";
    if (canQueue && (!navigator.onLine || outboxRef.current.length > 0)) return enqueue();
    try {
      await runOp(backend, op);
      setData((d) => applyLocal(d, op));
      void refresh();
      return "guardado";
    } catch (err) {
      const e = toAppError(err);
      if (canQueue && e.kind === "sin_conexion") return enqueue();
      throw e;
    }
  }, [backend, persistOutbox, refresh]);

  const value = useMemo<StoreValue>(() => ({
    data, ready, status, lastSync, pending: outbox.length, failed, profile, mode: backend.mode, refresh, mutate,
    insert: (table, rows, label) => {
      const withIds = rows.map((r) => (PRIMARY_KEYS[table] || (r as { id?: string }).id ? r : { ...r, id: crypto.randomUUID() }));
      return mutate({ kind: "insert", table, rows: withIds as Record<string, unknown>[] }, label);
    },
    update: (table, where, patch, label) => mutate({ kind: "update", table, where: where as Record<string, unknown>, patch: patch as Record<string, unknown> }, label),
    remove: (table, where, label) => mutate({ kind: "remove", table, where: where as Record<string, unknown> }, label),
    signIn: async (email, password) => { const p = await backend.signIn(email, password); setProfile(p); await refresh(); return p; },
    signOut: async () => { await backend.signOut(); setProfile(null); await refresh(); },
    dismissFailed: () => setFailed([]),
  }), [data, ready, status, lastSync, outbox.length, failed, profile, backend, refresh, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export type { Row };
