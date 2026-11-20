"use client";

import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** Campo con etiqueta visible, ayuda y error junto al control (Nielsen 5 y 9). */
export function Field({ label, hint, error, children, optional }: {
  label: string; hint?: string; error?: string; optional?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}{optional && <span className="ml-1 font-normal text-[var(--muted)]">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": desc })}
      {error ? <p id={`${id}-err`} className="text-sm text-[var(--danger)]">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

/** Indicador de pasos para formularios divididos. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Pasos">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${i < current ? "bg-[var(--accent)] text-white" : i === current ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
            {i < current ? <Check className="size-4" /> : i + 1}
          </span>
          <span className={`truncate text-sm ${i === current ? "block font-semibold" : "hidden text-[var(--muted)] sm:block"}`}>{s}</span>
          {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < current ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />}
        </li>
      ))}
    </ol>
  );
}

/** Botón que ejecuta una acción async mostrando estado (evita doble envío). */
export function SubmitButton({ busy, children, className = "btn-primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...rest} disabled={busy || rest.disabled} className={`btn ${className}`}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

/** Confirmación en dos toques, sin ventanas emergentes (prevención de errores). */
export function ConfirmButton({ onConfirm, children, confirmText = "¿Seguro? Toca para confirmar", className = "btn-outline", disabled }: {
  onConfirm: () => void | Promise<void>; children: ReactNode; confirmText?: string; className?: string; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy || disabled}
      className={`btn ${armed ? "btn-danger" : className}`}
      onBlur={() => setArmed(false)}
      onClick={async () => {
        if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{armed ? confirmText : children}
    </button>
  );
}

/** Contador grande para marcadores: fácil de tocar en la cancha. */
export function ScoreStepper({ value, onChange, label, max = 99 }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label={label}>
      <button type="button" className="grid size-14 place-items-center rounded-2xl bg-[var(--brand)] text-white active:scale-95 dark:text-[#0b1220]"
        onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Sumar a ${label}`}><Plus className="size-7" /></button>
      <input type="number" inputMode="numeric" min={0} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className="font-display tabular w-20 bg-transparent text-center text-5xl font-extrabold focus:outline-none" />
      <button type="button" className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] active:scale-95 disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Restar a ${label}`}><Minus className="size-5" /></button>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 md:p-5 ${className}`}>{children}</div>;
}
