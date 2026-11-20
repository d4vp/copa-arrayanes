"use client";

import { ChevronLeft, ChevronRight, Megaphone, ShoppingBasket, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Notice } from "@/lib/types";
import { RollingBall } from "./sports";

const ICON = { comunidad: Megaphone, ventas: ShoppingBasket, partido: Trophy };
const LABEL = { comunidad: "Aviso de la comunidad", ventas: "Ventas", partido: "Información del partido" };

/** Avisos parroquiales: un banner pequeño, rota cada 7 s y se puede cerrar. */
export function NoticeBanner({ notices }: { notices: Notice[] }) {
  const now = new Date().toISOString();
  const [hidden, setHidden] = useState<string[]>([]);
  const list = notices.filter((n) => n.active && n.starts_at <= now && (!n.ends_at || n.ends_at > now) && !hidden.includes(n.id));
  const [i, setI] = useState(0);
  useEffect(() => {
    try { setHidden(JSON.parse(sessionStorage.getItem("copa-avisos-ocultos") ?? "[]")); } catch { /* */ }
  }, []);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 7000);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return null;
  const n = list[i % list.length];
  const Icon = ICON[n.kind];
  const hide = () => {
    const next = [...hidden, n.id];
    setHidden(next);
    try { sessionStorage.setItem("copa-avisos-ocultos", JSON.stringify(next)); } catch { /* */ }
  };
  return (
    <aside aria-label="Avisos de la comunidad" className="card fade-up roll-host relative flex items-center gap-3 overflow-hidden border-l-4 border-l-[var(--accent)] p-3">
      <RollingBall key={`ball-${n.id}-${i}`} />
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="size-5" aria-hidden /></span>
      <div key={n.id} className="fade-up min-w-0 flex-1" aria-live="polite">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">{LABEL[n.kind]}</p>
        <p className="truncate text-sm font-semibold">{n.title}</p>
        {n.body && <p className="line-clamp-2 text-xs text-[var(--muted)]">{n.body}</p>}
      </div>
      {list.length > 1 && (
        <div className="flex shrink-0">
          <button aria-label="Aviso anterior" className="rounded-full p-1.5 hover:bg-[var(--surface-2)]" onClick={() => setI((x) => x + list.length - 1)}><ChevronLeft className="size-4" /></button>
          <button aria-label="Aviso siguiente" className="rounded-full p-1.5 hover:bg-[var(--surface-2)]" onClick={() => setI((x) => x + 1)}><ChevronRight className="size-4" /></button>
        </div>
      )}
      <button aria-label="Ocultar este aviso" className="shrink-0 rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]" onClick={hide}><X className="size-4" /></button>
    </aside>
  );
}
