"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, Image as ImageIcon, LayoutDashboard, LogOut, Megaphone, Sparkles, Trophy, UserCog, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand";
import { Field, SubmitButton } from "@/components/form";
import { useToast } from "@/components/toast";
import { ListSkeleton } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { toAppError } from "@/lib/errors";
import type { StaffRole } from "@/lib/types";
import { fieldErrors, loginSchema } from "@/lib/validation";

const ROLE_LABEL: Record<StaffRole, string> = { admin: "Administrador", organizador: "Organizador", planillero: "Planillero", delegado: "Delegado" };

/** Cada rol ve solo lo que necesita (minimalismo, Nielsen 8). */
const NAV: Array<{ href: string; label: string; icon: typeof Trophy; roles: StaffRole[] }> = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, roles: ["admin", "organizador", "planillero", "delegado"] },
  { href: "/admin/asistente", label: "Asistente", icon: Sparkles, roles: ["admin", "organizador", "planillero"] },
  { href: "/admin/partidos", label: "Partidos", icon: CalendarDays, roles: ["admin", "organizador", "planillero"] },
  { href: "/admin/planillas", label: "Planillas", icon: ClipboardCheck, roles: ["admin", "organizador"] },
  { href: "/admin/ediciones", label: "Ediciones", icon: Trophy, roles: ["admin", "organizador"] },
  { href: "/admin/equipos", label: "Equipos", icon: Users, roles: ["admin", "organizador", "delegado"] },
  { href: "/admin/avisos", label: "Avisos", icon: Megaphone, roles: ["admin", "organizador"] },
  { href: "/admin/galeria", label: "Galería", icon: ImageIcon, roles: ["admin", "organizador"] },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, ready, signOut } = useStore();
  const path = usePathname();
  if (path === "/admin/clave") return <>{children}</>;
  if (!ready) return <ListSkeleton rows={4} />;
  if (!profile) return <Login />;

  const items = NAV.filter((n) => n.roles.includes(profile.role));
  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-6">
      <aside className="mb-4 md:mb-0">
        <div className="mb-3 hidden rounded-xl bg-[var(--surface-2)] p-3 md:block">
          <p className="truncate text-sm font-semibold">{profile.full_name}</p>
          <p className="text-xs text-[var(--muted)]">{ROLE_LABEL[profile.role]}</p>
        </div>
        <nav aria-label="Gestión" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:px-0">
          {items.map(({ href, label, icon: Icon }) => {
            const on = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium md:rounded-lg ${on ? "bg-[var(--brand)] text-white dark:text-[#0b1220]" : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] md:bg-transparent md:hover:bg-[var(--surface-2)]"}`}>
                <Icon className="size-4" aria-hidden />{label}
              </Link>
            );
          })}
          <button onClick={() => void signOut()} className="flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--danger)] md:mt-4 md:rounded-lg">
            <LogOut className="size-4" aria-hidden />Salir
          </button>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Login() {
  const { signIn, mode } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    try {
      const p = await signIn(parsed.data.email, parsed.data.password);
      toast.show({ tone: "exito", title: `Bienvenido, ${p.full_name}` });
    } catch (err) {
      setFormError(toAppError(err).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark className="size-16" />
        <h1 className="font-display mt-3 text-2xl font-extrabold">Gestión del campeonato</h1>
        <p className="text-sm text-[var(--muted)]">Solo para el comité, planilleros y delegados. Para ver resultados no necesitas entrar.</p>
      </div>
      <form onSubmit={submit} noValidate className="card space-y-4 p-5">
        {formError && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-[var(--danger)]">{formError}</p>}
        <Field label="Correo" error={errors.email}>
          {(p) => <input {...p} className="input" type="email" autoComplete="username" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Contraseña" error={errors.password}>
          {(p) => <input {...p} className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <SubmitButton busy={busy} type="submit" className="btn-primary w-full">Entrar</SubmitButton>
        {mode === "supabase" ? <Link href="/admin/clave" className="block text-center text-sm text-[var(--brand)]">Olvidé mi contraseña</Link> : (
          <div className="rounded-lg bg-amber-400/10 p-3 text-xs">
            <p className="font-semibold">Modo demostración: contraseña <code>demo</code></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["organizador", "planillero", "delegado", "admin"].map((r) => (
                <button key={r} type="button" className="chip h-7 text-xs" onClick={() => setForm({ email: `${r}@demo.co`, password: "demo" })}>{r}</button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
