"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { CategoryPicker, usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, ListSkeleton, PageHeader, Segmented } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { byDate } from "@/lib/data/selectors";
import { useStore } from "@/lib/data/store";
import { fmtDate, fmtTime, isoToLocalInput, localInputToIso, MATCH_STATUS_LABEL } from "@/lib/format";
import type { Match } from "@/lib/types";

type Filter = "pendientes" | "sin_fecha" | "jugados";

function PartidosAdmin() {
  const params = useSearchParams();
  const { data, ready, teams, categories } = usePublic();
  const [cat, setCat] = useState(params.get("categoria") ?? "todas");
  const [filter, setFilter] = useState<Filter>("pendientes");

  const list = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return data.matches
      .filter((m) => ids.has(m.category_id) && (cat === "todas" || m.category_id === cat))
      .filter((m) => filter === "jugados" ? m.status === "finalizado" : filter === "sin_fecha" ? !m.scheduled_at && m.status !== "finalizado" : m.status !== "finalizado" && m.status !== "cancelado")
      .sort(filter === "jugados" ? (a, b) => byDate(b, a) : byDate);
  }, [data.matches, categories, cat, filter]);

  const noDate = data.matches.filter((m) => categories.some((c) => c.id === m.category_id) && !m.scheduled_at && m.status !== "finalizado").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Partidos" subtitle="Toca un partido para registrar el resultado. La fecha se edita aquí mismo." />
      <Segmented label="Filtro" value={filter} onChange={setFilter} options={[
        { value: "pendientes", label: "Por jugar" },
        { value: "sin_fecha", label: `Sin fecha${noDate ? ` (${noDate})` : ""}` },
        { value: "jugados", label: "Jugados" },
      ]} />
      <CategoryPicker categories={categories} value={cat} onChange={setCat} allowAll />
      {!ready ? <ListSkeleton /> : list.length === 0 ? <EmptyState icon={<CalendarClock className="size-8" />} title="No hay partidos en este filtro" /> : (
        <ul className="card divide-y divide-[var(--border)]">
          {list.map((m) => <Row key={m.id} m={m} teams={teams} catName={categories.find((c) => c.id === m.category_id)?.name ?? ""} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ m, teams, catName }: { m: Match; teams: ReturnType<typeof usePublic>["teams"]; catName: string }) {
  const store = useStore();
  const toast = useToast();
  const canSchedule = store.profile?.role === "admin" || store.profile?.role === "organizador";
  const h = teams.get(m.home_team_id ?? ""), a = teams.get(m.away_team_id ?? "");
  const saveDate = async (v: string) => {
    try { toast.saved(await store.update("matches", { id: m.id }, { scheduled_at: localInputToIso(v) }, "Fecha"), "Fecha"); }
    catch (e) { toast.error(e, "No se guardó la fecha"); }
  };
  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <Link href={`/admin/partido?id=${m.id}`} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">{catName} · {m.stage === "grupo" ? `Grupo ${m.group_label} · F${m.round}` : m.stage === "liga" ? `Fecha ${m.round}` : STAGE_LABEL[m.stage]}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Crest team={h} size={20} /><span className="truncate">{h?.name ?? "Por definir"}</span>
            <span className="tabular px-1 text-[var(--muted)]">{m.status === "finalizado" ? `${m.home_score}-${m.away_score}` : "vs"}</span>
            <Crest team={a} size={20} /><span className="truncate">{a?.name ?? "Por definir"}</span>
          </p>
        </div>
        {m.status !== "programado" && m.status !== "finalizado" && <Badge tone="warning">{MATCH_STATUS_LABEL[m.status]}</Badge>}
        <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" />
      </Link>
      {canSchedule && m.status !== "finalizado" ? (
        <input type="datetime-local" aria-label="Fecha y hora" className="input sm:w-56" defaultValue={isoToLocalInput(m.scheduled_at)}
          onBlur={(e) => { if (e.target.value !== isoToLocalInput(m.scheduled_at)) void saveDate(e.target.value); }} />
      ) : <span className="text-sm text-[var(--muted)]">{fmtDate(m.scheduled_at)} {m.scheduled_at && fmtTime(m.scheduled_at)}</span>}
    </li>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><PartidosAdmin /></Suspense>;
}
