"use client";

import { UserCog } from "lucide-react";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Card } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import type { StaffRole } from "@/lib/types";

const ROLES: Array<{ v: StaffRole; l: string; d: string }> = [
  { v: "admin", l: "Administrador", d: "Todo, incluidos roles y reabrir ediciones" },
  { v: "organizador", l: "Organizador", d: "Ediciones, equipos, partidos, avisos" },
  { v: "planillero", l: "Planillero", d: "Envía planillas para revisión" },
  { v: "delegado", l: "Delegado", d: "Plantilla de su equipo" },
];

/** Gestión de roles. Las cuentas se crean invitando desde Supabase (ver docs/DESPLIEGUE.md). */
export default function UsuariosPage() {
  const { data, teams } = usePublic();
  const store = useStore();
  const toast = useToast();
  const set = (id: string, patch: { role?: StaffRole; team_id?: string | null }) =>
    store.update("profiles", { id }, patch, "Usuario").then((r) => toast.saved(r, "Usuario")).catch((e) => toast.error(e));

  return (
    <div className="space-y-4">
      <PageHeader title="Usuarios" subtitle="Asigna el rol mínimo necesario a cada persona." />
      <Card className="text-sm">
        <p className="font-semibold">¿Cómo agregar a alguien?</p>
        <p className="text-[var(--muted)]">{store.mode === "local"
          ? "En modo demostración los usuarios son fijos. Con Supabase: Authentication → Users → Invite user. La persona aparece aquí como Delegado y tú le cambias el rol."
          : "En Supabase: Authentication → Users → Invite user, con su correo. Cuando acepte, aparecerá aquí como Delegado y podrás cambiar su rol."}</p>
      </Card>
      {data.profiles.length === 0 ? <EmptyState icon={<UserCog className="size-8" />} title="Sin usuarios registrados" /> : (
        <ul className="card divide-y divide-[var(--border)]">
          {data.profiles.map((p) => (
            <li key={p.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_12rem_12rem] sm:items-center">
              <span className="font-semibold">{p.full_name}{p.id === store.profile?.id && <span className="ml-2 text-xs text-[var(--muted)]">(tú)</span>}</span>
              <select className="input" aria-label={`Rol de ${p.full_name}`} value={p.role} disabled={p.id === store.profile?.id}
                onChange={(e) => set(p.id, { role: e.target.value as StaffRole, team_id: e.target.value === "delegado" ? p.team_id : null })}>
                {ROLES.map((r) => <option key={r.v} value={r.v} title={r.d}>{r.l}</option>)}
              </select>
              {p.role === "delegado" ? (
                <select className="input" aria-label={`Equipo de ${p.full_name}`} value={p.team_id ?? ""} onChange={(e) => set(p.id, { team_id: e.target.value || null })}>
                  <option value="">Sin equipo</option>
                  {[...teams.values()].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : <span className="text-xs text-[var(--muted)]">{ROLES.find((r) => r.v === p.role)?.d}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
