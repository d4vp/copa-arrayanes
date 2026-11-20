"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CloudOff, Home, ListOrdered, Megaphone, Monitor, Moon, MoreHorizontal, RefreshCw, Shield, Sun, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/data/store";
import { timeAgo } from "@/lib/format";
import { LogoMark, Logo } from "./brand";
import { useToast } from "./toast";
import { GoalWatcher, RunningKid } from "./sports";
import { SponsorsFooter } from "./sponsors";

const NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/partidos", label: "Partidos", icon: CalendarDays },
  { href: "/tabla", label: "Tabla", icon: ListOrdered },
  { href: "/equipos", label: "Equipos", icon: Users },
  { href: "/mas", label: "Más", icon: MoreHorizontal },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isAdmin = path.startsWith("/admin");
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:p-2">Saltar al contenido</a>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label="Copa Arrayanes, inicio" className="shrink-0"><Logo compact /></Link>
          {isAdmin && <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-bold text-[var(--brand)]">Gestión</span>}
          <nav aria-label="Principal" className="ml-4 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(path, n.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active(path, n.href) ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <SyncPill />
            <ThemeToggle />
            <Link href="/admin" className="btn btn-ghost hidden px-3 text-sm md:inline-flex" title="Gestión del campeonato">
              <Shield className="size-4" aria-hidden />Gestión
            </Link>
          </div>
        </div>
        <ModeBanner />
      </header>

      <main id="contenido" className={`mx-auto max-w-6xl px-4 pt-4 ${isAdmin ? "pb-28 md:pb-12" : "pb-4"}`}>{children}</main>
      {!isAdmin && <SponsorsFooter />}

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = active(path, n.href);
            const Icon = n.icon;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium ${on ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}>
                  <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${on ? "bg-[var(--brand-soft)]" : ""}`}><Icon className="size-5" aria-hidden /></span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Welcome />
      <GoalWatcher />
    </>
  );
}

/** Visibilidad del estado del sistema (Nielsen 1): conexión y cambios pendientes. */
function SyncPill() {
  const { status, lastSync, pending, refresh, failed, dismissFailed } = useStore();
  const toast = useToast();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  if (failed.length) {
    return (
      <button className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-[var(--danger)]"
        onClick={() => {
          failed.forEach((f) => toast.show({ tone: "error", title: `No se guardó: ${f.label}`, detail: `${f.error.message} ${f.error.hint ?? ""}`.trim() }));
          dismissFailed();
        }}>
        {failed.length} cambio(s) no se guardaron · ver
      </button>
    );
  }
  if (status === "sin_conexion") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-[var(--warning)]"
        title={`Mostrando datos guardados ${timeAgo(lastSync)}`} role="status">
        <CloudOff className="size-3.5" aria-hidden />
        <span>Sin conexión{pending ? ` · ${pending} pendiente${pending > 1 ? "s" : ""}` : ""}</span>
      </span>
    );
  }
  if (status === "sincronizando" || status === "cargando") {
    return <span className="flex items-center gap-1.5 px-2 text-xs text-[var(--muted)]" role="status"><RefreshCw className="size-3.5 animate-spin" aria-hidden /><span className="hidden sm:inline">Actualizando…</span></span>;
  }
  return (
    <button onClick={() => void refresh()} className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] sm:flex"
      title="Actualizar ahora">
      <span className="size-2 rounded-full bg-[var(--accent)]" aria-hidden />Actualizado {timeAgo(lastSync)}
    </button>
  );
}

type ThemeChoice = "sistema" | "claro" | "oscuro";
export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "oscuro" || (choice === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1220" : "#ffffff");
}

function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("sistema");
  useEffect(() => {
    try { setChoice((localStorage.getItem("copa-tema") as ThemeChoice) || "sistema"); } catch { /* */ }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => { const c = (localStorage.getItem("copa-tema") as ThemeChoice) || "sistema"; if (c === "sistema") applyTheme(c); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const next: Record<ThemeChoice, ThemeChoice> = { sistema: "claro", claro: "oscuro", oscuro: "sistema" };
  const Icon = choice === "claro" ? Sun : choice === "oscuro" ? Moon : Monitor;
  const label = { sistema: "Tema automático", claro: "Tema claro", oscuro: "Tema oscuro" }[choice];
  return (
    <button className="grid size-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)]"
      aria-label={`${label}. Cambiar tema`} title={label}
      onClick={() => { const c = next[choice]; setChoice(c); try { localStorage.setItem("copa-tema", c); } catch { /* */ } applyTheme(c); }}>
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

function ModeBanner() {
  const { mode } = useStore();
  if (mode !== "local") return null;
  return (
    <p className="bg-amber-400/15 px-4 py-1 text-center text-xs text-[var(--text)]">
      Modo demostración: los datos son de prueba y se guardan solo en este dispositivo.
    </p>
  );
}

/** Pantalla de bienvenida (solo la primera visita). */
function Welcome() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem("copa-bienvenida")) setShow(true); } catch { /* */ }
  }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem("copa-bienvenida", "1"); } catch { /* */ } setShow(false); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bienvenida-titulo" className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-b from-[#1e3a8a] to-[#1d4ed8] p-6 text-white">
      <button onClick={close} aria-label="Cerrar bienvenida" className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-full p-2 hover:bg-white/10"><X className="size-6" /></button>
      <div className="fade-up flex max-w-sm flex-col items-center text-center">
        <LogoMark className="size-24 drop-shadow-xl" />
        <h1 id="bienvenida-titulo" className="font-display mt-6 text-4xl font-extrabold leading-none tracking-wide">COPA<br />ARRAYANES</h1>
        <p className="mt-3 text-blue-100">Vereda Los Arrayanes · Córdoba, Nariño</p>
        <RunningKid className="mt-4 h-24 w-40" color="#ffffff" jersey="#22c55e" />
        <ul className="mt-8 space-y-3 text-left text-sm text-blue-50">
          <li className="flex gap-3"><CalendarDays className="size-5 shrink-0 text-emerald-300" />Partidos, resultados y tabla al día.</li>
          <li className="flex gap-3"><span className="text-lg leading-none text-amber-300">★</span>Marca tu equipo o vereda como favorito.</li>
          <li className="flex gap-3"><Megaphone className="size-5 shrink-0 text-emerald-300" />Avisos de la comunidad durante la copa.</li>
          <li className="flex gap-3"><CloudOff className="size-5 shrink-0 text-emerald-300" />Funciona sin señal con lo último que viste.</li>
        </ul>
        <button onClick={close} className="btn mt-10 w-full bg-white text-[#1e3a8a] hover:bg-blue-50">Entrar</button>
      </div>
    </div>
  );
}
