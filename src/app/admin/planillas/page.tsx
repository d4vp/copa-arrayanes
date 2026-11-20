"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useState } from "react";
import { Crest } from "@/components/crest";
import { EventIcon } from "@/components/event-icon";
import { Card, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { fmtDate, fmtTime } from "@/lib/format";
import type { MatchReport } from "@/lib/types";

/** Verificación de planillas enviadas por planilleros. */
export default function PlanillasPage() {
  const { data } = usePublic();
  const pending = data.match_reports.filter((r) => r.status === "pendiente").sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div className="space-y-4">
      <PageHeader title="Planillas por revisar" subtitle="Lo que envían los planilleros se publica solo cuando lo apruebas." />
      {pending.length === 0 ? <EmptyState icon={<ClipboardCheck className="size-8" />} title="Todo al día" text="No hay planillas pendientes." /> :
        pending.map((r) => <ReportCard key={r.id} r={r} />)}
    </div>
  );
}

function ReportCard({ r }: { r: MatchReport }) {
  const { data, teams } = usePublic();
  const store = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<"a" | "r" | null>(null);
  const [note, setNote] = useState("");
  const m = data.matches.find((x) => x.id === r.match_id);
  const h = teams.get(m?.home_team_id ?? ""), a = teams.get(m?.away_team_id ?? "");
  const players = new Map(data.players.map((p) => [p.id, p.full_name]));
  const changesScore = m?.status === "finalizado" && (m.home_score !== r.data.home_score || m.away_score !== r.data.away_score);

  const approve = async () => {
    setBusy("a");
    try { await store.mutate({ kind: "rpc", name: "approve_match_report", args: { p_report: r.id, p_note: note || null } }, "Aprobar planilla"); await store.refresh(); toast.show({ tone: "exito", title: "Planilla aprobada y publicada" }); }
    catch (e) { toast.error(e, "No se aprobó"); } finally { setBusy(null); }
  };
  const reject = async () => {
    setBusy("r");
    try { toast.saved(await store.update("match_reports", { id: r.id }, { status: "rechazado", review_note: note || "Rechazada" }, "Planilla"), "Planilla rechazada"); }
    catch (e) { toast.error(e, "No se rechazó"); } finally { setBusy(null); }
  };

  return (
    <Card className="space-y-3">
      <p className="text-xs text-[var(--muted)]">Enviada {fmtDate(r.created_at)} {fmtTime(r.created_at)}</p>
      <div className="flex items-center justify-center gap-3">
        <Crest team={h} size={32} /><span className="font-semibold">{h?.name}</span>
        <span className="font-display tabular text-3xl font-extrabold">{r.data.home_score} - {r.data.away_score}</span>
        <span className="font-semibold">{a?.name}</span><Crest team={a} size={32} />
      </div>
      {r.data.home_penalties != null && <p className="text-center text-sm">Penales {r.data.home_penalties} - {r.data.away_penalties}</p>}
      {changesScore && <p className="rounded-lg bg-amber-500/10 p-2 text-sm text-[var(--warning)]">Cambia el resultado ya publicado ({m!.home_score}-{m!.away_score}).</p>}
      {r.data.events.length > 0 && (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {r.data.events.map((e, i) => <li key={i}><EventIcon type={e.type} className="mr-1 inline-block align-[-2px]" />{e.player_id ? players.get(e.player_id) : "Sin identificar"} <span className="text-[var(--muted)]">· {teams.get(e.team_id)?.name}</span></li>)}
        </ul>
      )}
      <input className="input" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-label="Nota de revisión" />
      <div className="flex gap-2">
        <SubmitButton busy={busy === "r"} className="btn-outline flex-1" onClick={reject}><X className="size-4" />Rechazar</SubmitButton>
        <SubmitButton busy={busy === "a"} className="btn-accent flex-1" onClick={approve}><Check className="size-4" />Aprobar y publicar</SubmitButton>
      </div>
    </Card>
  );
}
