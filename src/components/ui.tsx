"use client";

import { RotateCw, SearchX, Star, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFavorites } from "@/lib/favorites";
import { toAppError } from "@/lib/errors";
import { SportsLoader } from "./sports";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`fade-up ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-[var(--muted)]">{icon ?? <SearchX className="size-8" aria-hidden />}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-[var(--muted)]">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toAppError(error);
  return (
    <div role="alert" className="card flex flex-col items-center gap-2 border-red-500/40 px-6 py-8 text-center">
      <TriangleAlert className="size-8 text-[var(--danger)]" aria-hidden />
      <p className="font-semibold">{e.message}</p>
      {e.hint && <p className="text-sm text-[var(--muted)]">{e.hint}</p>}
      {onRetry && <button className="btn btn-outline mt-2" onClick={onRetry}><RotateCw className="size-4" />Reintentar</button>}
    </div>
  );
}

export function Skeleton({ className = "h-16" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <SportsLoader compact />
      <div className="space-y-2 opacity-60">{Array.from({ length: Math.min(rows, 3) }, (_, i) => <Skeleton key={i} />)}</div>
    </div>
  );
}

/** Estrella de favorito: se rellena al marcar, con micro-animación. */
export function FavoriteButton({ kind, id, label, size = "md" }: { kind: "teams" | "veredas"; id: string; label: string; size?: "sm" | "md" }) {
  const { fav, toggle } = useFavorites();
  const [anim, setAnim] = useState(0);
  const on = fav[kind].includes(id);
  const s = size === "sm" ? "size-5" : "size-6";
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Quitar ${label} de favoritos` : `Marcar ${label} como favorito`}
      title={on ? "Quitar de favoritos" : "Marcar como favorito"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(kind, id); setAnim((a) => a + 1); }}
      className="grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--surface-2)]">
      <Star key={anim} className={`${s} ${anim ? "pop" : ""} ${on ? "fill-amber-400 text-amber-400" : "text-[var(--muted)]"}`} aria-hidden />
    </button>
  );
}

/** Pestañas segmentadas accesibles (desplazables en móvil). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className="chip" onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "accent" | "live" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--muted)]",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    live: "bg-rose-500/10 text-[var(--live)]",
    warning: "bg-amber-500/10 text-[var(--warning)]",
    danger: "bg-red-500/10 text-[var(--danger)]",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
