"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { EventIcon } from "@/components/event-icon";
import { Card, Field, ScoreStepper, Steps, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, ListSkeleton, Segmented } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { goalsFromEvents, saveMatchResult } from "@/lib/data/results";
import { useStore } from "@/lib/data/store";
import { isoToLocalInput, localInputToIso, MATCH_STATUS_LABEL } from "@/lib/format";
import type { EventType, Match, MatchStatus } from "@/lib/types";

type Draft = { team_id: string; player_id: string | null; type: EventType; minute: number | null; key: string };
const EVENT_BTN: Array<{ type: EventType; label: string }> = [
  { type: "gol", label: "Gol" }, { type: "amarilla", label: "Amarilla" },
  { type: "roja", label: "Roja" }, { type: "autogol", label: "Autogol" },
];

function RegistrarPartido() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { data, ready, teams } = usePublic();
  const store = useStore();
  const m = data.matches.find((x) => x.id === id);
  const [tab, setTab] = useState<"resultado" | "programacion">("resultado");

  if (!ready) return <ListSkeleton rows={3} />;
  if (!m) return <EmptyState title="Partido no encontrado" action={<Link href="/admin/partidos" className="btn btn-primary">Volver</Link>} />;
  const cat = data.categories.find((c) => c.id === m.category_id)!;
  const edition = data.editions.find((e) => e.id === cat.edition_id);
  const closed = edition?.status === "finalizado";
  const isOrganizer = store.profile?.role === "admin" || store.profile?.role === "organizador";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button onClick={() => router.back()} className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Volver</button>
      <header>
        <p className="text-sm text-[var(--muted)]">{cat.name} · {m.stage === "grupo" ? `Grupo ${m.group_label} · Fecha ${m.round}` : m.stage === "liga" ? `Fecha ${m.round}` : STAGE_LABEL[m.stage]}</p>
        <h1 className="font-display text-2xl font-extrabold">{teams.get(m.home_team_id ?? "")?.name ?? "Por definir"} vs {teams.get(m.away_team_id ?? "")?.name ?? "Por definir"}</h1>
      </header>
      {closed ? (
        <EmptyState title="Edición finalizada" text="El historial está protegido. Solo un administrador puede reabrir la edición." />
      ) : (
        <>
          {isOrganizer && <Segmented label="Sección" value={tab} onChange={setTab} options={[{ value: "resultado", label: "Resultado" }, { value: "programacion", label: "Fecha y lugar" }]} />}
          {tab === "resultado" || !isOrganizer
            ? <ResultWizard match={m} isOrganizer={isOrganizer} onDone={() => router.push(isOrganizer ? "/admin" : "/admin/partidos")} />
            : <ScheduleForm match={m} />}
        </>
      )}
    </div>
  );
}

function ResultWizard({ match: m, isOrganizer, onDone }: { match: Match; isOrganizer: boolean; onDone: () => void }) {
  const { data, teams } = usePublic();
  const store = useStore();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [hs, setHs] = useState(m.home_score ?? 0);
  const [as, setAs] = useState(m.away_score ?? 0);
  const [hp, setHp] = useState<number | null>(m.home_penalties);
  const [ap, setAp] = useState<number | null>(m.away_penalties);
  const [events, setEvents] = useState<Draft[]>(() => data.match_events.filter((e) => e.match_id === m.id).map((e) => ({ ...e, key: e.id })));
  const [team, setTeam] = useState<string>(m.home_team_id ?? "");
  const [busy, setBusy] = useState(false);

  const knockout = !["liga", "grupo"].includes(m.stage);
  const tie = hs === as;
  const home = teams.get(m.home_team_id ?? ""), away = teams.get(m.away_team_id ?? "");
  const roster = useMemo(() => data.players.filter((p) => p.team_id === team && p.active).sort((a, b) => (a.number ?? 99) - (b.number ?? 99)), [data.players, team]);
  const playerName = (pid: string | null) => (pid ? data.players.find((p) => p.id === pid)?.full_name : null) ?? "Sin jugador";

  // Coherencia planilla vs marcador (prevención de errores)
  const goalsFor = (tid: string | null) => goalsFromEvents(events, tid);
  const mismatch = events.some((e) => e.type === "gol" || e.type === "autogol") && (goalsFor(m.home_team_id) !== hs || goalsFor(m.away_team_id) !== as);
  const penaltiesMissing = knockout && tie && (hp == null || ap == null || hp === ap);

  useEffect(() => { if (!knockout || !tie) { setHp(null); setAp(null); } }, [knockout, tie]);

  if (!m.home_team_id || !m.away_team_id) return <EmptyState title="Equipos por definir" text="Este cruce se completa cuando termine la ronda anterior." />;

  const add = (type: EventType, player_id: string | null) => setEvents((ev) => [...ev, { team_id: team, player_id, type, minute: null, key: crypto.randomUUID() }]);

  const save = async () => {
    setBusy(true);
    const payload = { home_score: hs, away_score: as, home_penalties: hp, away_penalties: ap };
    const evRows = events.map(({ team_id, player_id, type, minute }) => ({ team_id, player_id, type, minute }));
    try {
      const r = await saveMatchResult(store, data, m, payload, evRows, isOrganizer);
      toast.saved(r.queued ? "en_cola" : "guardado", isOrganizer ? "Resultado" : "Planilla enviada para revisión");
      if (r.created.length) toast.show({ tone: "info", title: `Se creó la siguiente ronda: ${r.created.map((x) => STAGE_LABEL[x]).join(" y ")}`, detail: "Asigna fecha y hora en Partidos." });
      onDone();
    } catch (e) { toast.error(e, "No se guardó"); } finally { setBusy(false); }
  };

  return (
    <div>
      <Steps steps={["Marcador", "Planilla", "Confirmar"]} current={step} />

      {step === 0 && (
        <Card className="fade-up">
          <Link href={`/admin/asistente?partido=${m.id}`} className="mb-5 flex items-center gap-3 rounded-xl bg-[var(--brand-soft)] p-3 text-sm hover:opacity-90">
            <Sparkles className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
            <span className="flex-1"><b>¿Prefieres dictarlo o enviar foto de la planilla?</b> El asistente llena el formulario y tú solo revisas.</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            {[{ t: home, v: hs, set: setHs }, null, { t: away, v: as, set: setAs }].map((s, i) => s ? (
              <div key={i} className="flex flex-col items-center gap-3">
                <Crest team={s.t} size={48} /><span className="text-center text-sm font-semibold">{s.t?.name}</span>
                <ScoreStepper value={s.v} onChange={s.set} label={`Goles de ${s.t?.name}`} />
              </div>
            ) : <span key={i} className="font-display pt-24 text-3xl text-[var(--muted)]">-</span>)}
          </div>
          {knockout && tie && (
            <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-3">
              <p className="mb-2 text-sm font-semibold">Empate en eliminatoria: registra los penales</p>
              <div className="grid grid-cols-2 gap-3">
                {[[home, hp, setHp], [away, ap, setAp]].map(([t, v, set], i) => (
                  <Field key={i} label={`Penales ${(t as typeof home)?.name}`}>{(p) => (
                    <input {...p} type="number" inputMode="numeric" min={0} className="input" value={(v as number | null) ?? ""} onChange={(e) => (set as (n: number | null) => void)(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))} />
                  )}</Field>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <button className="btn btn-outline flex-1" disabled={penaltiesMissing} onClick={() => setStep(2)}>Guardar sin planilla</button>
            <button className="btn btn-primary flex-1" disabled={penaltiesMissing} onClick={() => setStep(1)}>Agregar planilla<ArrowRight className="size-4" /></button>
          </div>
          {penaltiesMissing && <p className="mt-2 text-center text-sm text-[var(--warning)]">Faltan los penales para definir quién avanza.</p>}
        </Card>
      )}

      {step === 1 && (
        <div className="fade-up space-y-3">
          <p className="text-sm text-[var(--muted)]">Opcional. Toca el equipo, luego la acción y el jugador. Sirve para goleadores y juego limpio.</p>
          <div className="grid grid-cols-2 gap-2">
            {[home, away].map((t) => t && (
              <button key={t.id} className="chip h-11 justify-center" aria-pressed={team === t.id} onClick={() => setTeam(t.id)}>
                <Crest team={t} size={22} />{t.name}
              </button>
            ))}
          </div>
          <Card className="space-y-3">
            {EVENT_BTN.map((b) => (
              <details key={b.type} className="group rounded-xl border border-[var(--border)]" open={b.type === "gol"}>
                <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-semibold"><EventIcon type={b.type} />{b.label}<span className="ml-auto text-xs text-[var(--muted)] group-open:hidden">Elegir jugador</span></summary>
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {roster.map((p) => (
                    <button key={p.id} className="chip" onClick={() => add(b.type, p.id)}><b className="tabular">{p.number ?? "–"}</b>{p.full_name.split(" ")[0]}</button>
                  ))}
                  <button className="chip border-dashed" onClick={() => add(b.type, null)}>Sin identificar</button>
                </div>
              </details>
            ))}
          </Card>
          {events.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Registrado ({events.length})</p>
              <ul className="divide-y divide-[var(--border)]">
                {events.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 py-2 text-sm">
                    <EventIcon type={e.type} />
                    <span className="flex-1">{playerName(e.player_id)} <span className="text-[var(--muted)]">· {teams.get(e.team_id)?.name}</span></span>
                    <button aria-label="Quitar" className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => setEvents((ev) => ev.filter((x) => x.key !== e.key))}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {mismatch && <p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm text-[var(--warning)]">Los goles de la planilla ({goalsFor(m.home_team_id)}-{goalsFor(m.away_team_id)}) no coinciden con el marcador ({hs}-{as}). Revisa antes de guardar.</p>}
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => setStep(0)}><ArrowLeft className="size-4" />Marcador</button>
            <button className="btn btn-primary flex-1" onClick={() => setStep(2)}>Revisar<ArrowRight className="size-4" /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card className="fade-up space-y-4 text-center">
          <p className="text-sm text-[var(--muted)]">Revisa antes de {isOrganizer ? "publicar" : "enviar"}</p>
          <p className="font-display text-2xl font-extrabold">{home?.name} <span className="tabular">{hs} - {as}</span> {away?.name}</p>
          {hp != null && <p className="text-sm">Penales {hp} - {ap}</p>}
          <p className="text-sm text-[var(--muted)]">{events.length ? `${events.filter((e) => e.type === "gol").length} goles con jugador · ${events.filter((e) => e.type === "amarilla" || e.type === "roja").length} tarjetas` : "Sin planilla"}</p>
          {mismatch && <p className="text-sm text-[var(--warning)]">La planilla no coincide con el marcador.</p>}
          {!isOrganizer && <p className="rounded-lg bg-[var(--brand-soft)] p-3 text-sm">El organizador revisará la planilla antes de publicarla.</p>}
          {isOrganizer && <p className="text-xs text-[var(--muted)]">Al publicar se notifica a quienes siguen a estos equipos.</p>}
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => setStep(events.length ? 1 : 0)}><ArrowLeft className="size-4" />Corregir</button>
            <SubmitButton busy={busy} className="btn-accent flex-1" onClick={save}>{isOrganizer ? "Publicar resultado" : "Enviar planilla"}</SubmitButton>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScheduleForm({ match }: { match: Match }) {
  const store = useStore();
  const { data } = store;
  const toast = useToast();
  const [when, setWhen] = useState(isoToLocalInput(match.scheduled_at));
  const [venue, setVenue] = useState(match.venue ?? "");
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [busy, setBusy] = useState(false);
  const venues = [...new Set(data.matches.map((x) => x.venue).filter(Boolean))] as string[];
  const save = async () => {
    setBusy(true);
    try {
      const r = await store.update("matches", { id: match.id }, { scheduled_at: localInputToIso(when), venue: venue.trim() || null, status, notes: notes.trim() || null }, "Programación");
      toast.saved(r, "Programación");
    } catch (e) { toast.error(e, "No se guardó"); } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-4">
      <Field label="Fecha y hora" hint="Hora de Colombia">{(p) => <input {...p} type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
      <Field label="Cancha" optional>{(p) => <><input {...p} className="input" list="canchas" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} /><datalist id="canchas">{venues.map((v) => <option key={v} value={v} />)}</datalist></>}</Field>
      <Field label="Estado">{(p) => (
        <select {...p} className="input" value={status} onChange={(e) => setStatus(e.target.value as MatchStatus)}>
          {(["programado", "en_juego", "aplazado", "cancelado"] as const).map((s) => <option key={s} value={s}>{MATCH_STATUS_LABEL[s]}</option>)}
          {match.status === "finalizado" && <option value="finalizado">Final</option>}
        </select>)}</Field>
      <Field label="Nota pública" optional hint="Ej.: aplazado por lluvia">{(p) => <input {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}</Field>
      <SubmitButton busy={busy} onClick={save} className="btn-primary w-full">Guardar</SubmitButton>
    </Card>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton rows={3} />}><RegistrarPartido /></Suspense>;
}
