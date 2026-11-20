"use client";

import { CheckCircle2, CloudOff, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toAppError } from "@/lib/errors";

type Tone = "exito" | "error" | "info" | "cola";
interface Toast { id: number; tone: Tone; title: string; detail?: string; action?: { label: string; run: () => void } }

interface ToastApi {
  show: (t: Omit<Toast, "id">) => void;
  /** Muestra el resultado de guardar: guardado o en cola sin conexión */
  saved: (result: "guardado" | "en_cola", what: string, undo?: () => void) => void;
  error: (err: unknown, context?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
export const useToast = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast fuera de ToastProvider");
  return c;
};

const ICON = { exito: CheckCircle2, error: TriangleAlert, info: Info, cola: CloudOff };
const TONE = {
  exito: "border-emerald-500/40",
  error: "border-red-500/50",
  info: "border-sky-500/40",
  cola: "border-amber-500/50",
};
const ICON_TONE = { exito: "text-emerald-600 dark:text-emerald-400", error: "text-red-600 dark:text-red-400", info: "text-sky-600 dark:text-sky-400", cola: "text-amber-600 dark:text-amber-400" };

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((cur) => [...cur.slice(-2), { ...t, id }]);
    setTimeout(() => dismiss(id), t.tone === "error" ? 8000 : t.action ? 6000 : 3500);
  }, [dismiss]);

  const api: ToastApi = {
    show,
    saved: (result, what, undo) => show(result === "guardado"
      ? { tone: "exito", title: `${what}: guardado`, action: undo ? { label: "Deshacer", run: undo } : undefined }
      : { tone: "cola", title: `${what}: guardado en el teléfono`, detail: "Se enviará cuando vuelva la conexión." }),
    error: (err, context) => {
      const e = toAppError(err);
      show({ tone: "error", title: context ? `${context}: ${e.message}` : e.message, detail: e.hint });
    },
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
              className={`toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-[var(--surface)] p-3 shadow-lg ${TONE[t.tone]}`}>
              <Icon className={`mt-0.5 size-5 shrink-0 ${ICON_TONE[t.tone]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.detail && <p className="text-sm text-[var(--muted)]">{t.detail}</p>}
              </div>
              {t.action && (
                <button className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>
              )}
              <button aria-label="Cerrar aviso" className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-2)]" onClick={() => dismiss(t.id)}>
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
