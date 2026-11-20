"use client";

import Link from "next/link";
import { ArrowRight, CalendarPlus, ClipboardCheck, Pencil, Users } from "lucide-react";
import { useMemo } from "react";
import { MatchCard } from "@/components/match-card";
import { usePublic } from "@/components/public-hooks";
import { EmptyState, PageHeader, Section } from "@/components/ui";
import { byDate } from "@/lib/data/selectors";
import { useStore } from "@/lib/data/store";
import { dayKey, EDITION_STATUS_LABEL } from "@/lib/format";

export default function AdminHome() {
  const { profile } = useStore();
  const { data, edition, teams, categories } = usePublic();
  const role = profile!.role;

  const { today, toRegister, pendingReports } = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    const ms = data.matches.filter((m) => ids.has(m.category_id));
    const todayKey = dayKey(new Date().toISOString());
    const now = new Date().toISOString();
    return {
      today: ms.filter((m) => dayKey(m.scheduled_at) === todayKey).sort(byDate),
      toRegister: ms.filter((m) => m.status !== "finalizado" && m.status !== "cancelado" && m.scheduled_at && m.scheduled_at < now).sort(byDate),
      pendingReports: data.match_reports.filter((r) => r.status === "pendiente"),
    };
  }, [data, categories]);

  if (role === "delegado") {
    return (
      <div className="space-y-4">
        <PageHeader title="Tu equipo" subtitle="Como delegado puedes mantener al día la plantilla de tu equipo." />
        {profile!.team_id ? (
          <Link href={`/admin/equipo?id=${profile!.team_id}`} className="card flex items-center gap-3 p-4 hover:shadow-md">
            <Users className="size-6 text-[var(--brand)]" /><span className="flex-1 font-semibold">Editar plantilla de {teams.get(profile!.team_id)?.name}</span><ArrowRight className="size-4" />
          </Link>
        ) : <EmptyState title="Aún no tienes equipo asignado" text="Pide al administrador que te asigne tu equipo." />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen" subtitle={edition ? `${edition.name} · ${EDITION_STATUS_LABEL[edition.status]}` : "Sin edición activa"} />

      {!edition && (
        <EmptyState title="Empieza creando la primera edición" text="Luego agregas categorías, inscribes equipos y generas el calendario."
          action={<Link href="/admin/ediciones?nueva=1" className="btn btn-primary"><CalendarPlus className="size-4" />Crear edición</Link>} />
      )}

      {pendingReports.length > 0 && role !== "planillero" && (
        <Link href="/admin/planillas" className="card flex items-center gap-3 border-amber-500/50 p-4 hover:shadow-md">
          <ClipboardCheck className="size-6 text-[var(--warning)]" />
          <span className="flex-1"><b>{pendingReports.length} planilla{pendingReports.length > 1 ? "s" : ""}</b> esperando tu revisión</span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      {toRegister.length > 0 && (
        <Section title="Falta registrar el resultado">
          <div className="grid gap-2 md:grid-cols-2">
            {toRegister.slice(0, 6).map((m) => <MatchCard key={m.id} match={m} teams={teams} href={`/admin/partido?id=${m.id}`} category={categories.find((c) => c.id === m.category_id)} />)}
          </div>
        </Section>
      )}

      <Section title="Partidos de hoy">
        {today.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {today.map((m) => <MatchCard key={m.id} match={m} teams={teams} href={`/admin/partido?id=${m.id}`} category={categories.find((c) => c.id === m.category_id)} />)}
          </div>
        ) : <EmptyState title="No hay partidos hoy" />}
      </Section>

      {role !== "planillero" && edition && (
        <Section title="Accesos rápidos">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { href: "/admin/partidos", label: "Programar partidos", icon: CalendarPlus },
              { href: `/admin/ediciones?id=${edition.id}`, label: "Categorías y calendario", icon: Pencil },
              { href: "/admin/avisos", label: "Publicar un aviso", icon: ArrowRight },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="card flex items-center gap-3 p-4 font-semibold hover:shadow-md"><Icon className="size-5 text-[var(--brand)]" />{label}</Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
