"use client";

import { ArrowLeft, ArrowRight, Camera, Check, Loader2, Mic, MicOff, Plus, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { AssistantMatch, AssistantResult, EventType } from "@shared/asistente";
import { Crest } from "@/components/crest";
import { EventIcon } from "@/components/event-icon";
import { Card, Steps, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, ListSkeleton, PageHeader } from "@/components/ui";
import { buildCandidates, photoToDataUrl, runAssistant, useDictation } from "@/lib/assistant";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { byDate } from "@/lib/data/selectors";
import { goalsFromEvents, saveMatchResult } from "@/lib/data/results";
import { useStore } from "@/lib/data/store";
import { toAppError } from "@/lib/errors";
import { dayKey, fmtDate, fmtTime, relativeDay } from "@/lib/format";
import type { Match } from "@/lib/types";

const EVENT_LABEL: Record<EventType, string> = { gol: "Gol", autogol: "Autogol", amarilla: "Amarilla", roja: "Roja" };
const CONF = { alta: { tone: "accent", l: "Lectura clara" }, media: { tone: "brand", l: "Revisa" }, baja: { tone: "warning", l: "Con dudas" } } as const;

type Review = AssistantMatch & { include: boolean };

function Asistente() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, ready, teams, categories } = usePublic();
  const store = useStore();
  const toast = useToast();
  const isOrganizer = store.profile?.role === "admin" || store.profile?.role === "organizador";

  // ---------- Paso 1: partidos ----------
  const pending = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return data.matches.filter((m) => ids.has(m.category_id) && m.home_team_id && m.away_team_id && m.status !== "finalizado" && m.status !== "cancelado").sort(byDate);
  }, [data.matches, categories]);
  const days = useMemo(() => [...new Set(pending.map((m) => dayKey(m.scheduled_at)))], [pending]);
  const today = dayKey(new Date().toISOString());
  const defaultDay = days.includes(today) ? today : [...days].reverse().find((d) => d <= today) ?? days[0];
  const fixed = params.get("partido");
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? defaultDay;
  const dayMatches = fixed ? data.matches.filter((m) => m.id === fixed) : pending.filter((m) => dayKey(m.scheduled_at) === activeDay);
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = dayMatches.filter((m) => !excluded.includes(m.id)).slice(0, 12);

  const [step, setStep] = useState(fixed ? 1 : 0);
  // ---------- Paso 2: dictado / fotos ----------
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const dict = useDictation((chunk) => setText((t) => (t ? `${t} ${chunk}` : chunk)));
  // ---------- Paso 3: revisión ----------
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [review, setReview] = useState<Review[]>([]);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);

  if (!ready) return <ListSkeleton />;
  const matchOf = (id: string) => data.matches.find((m) => m.id === id)!;
  const label = (m: Match) => `${teams.get(m.home_team_id!)?.name} vs ${teams.get(m.away_team_id!)?.name}`;

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all([...files].slice(0, 3 - photos.length).map(photoToDataUrl));
      setPhotos((p) => [...p, ...urls].slice(0, 3));
    } catch (e) { toast.error(e, "Foto"); }
  };

  const read = async () => {
    dict.stop();
    setReadError(null); setReading(true);
    try {
      const res = await runAssistant({ candidates: buildCandidates(data, selected.map((m) => m.id)), text, images: photos });
      setResult(res);
      setReview(res.results.map((r) => ({ ...r, include: true })));
      if (res.results.length === 0) setReadError(res.not_understood ?? "No encontré resultados. Revisa el dictado o la foto.");
      else setStep(2);
    } catch (e) { setReadError(toAppError(e).message); }
    finally { setReading(false); }
  };

  const patch = (i: number, p: Partial<Review>) => setReview((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const saveAll = async () => {
    const list = review.filter((r) => r.include);
    setSaving({ done: 0, total: list.length });
    let ok = 0, queued = 0;
    const failed: string[] = [];
    for (const r of list) {
      const m = matchOf(r.match_id);
      try {
        const res = await saveMatchResult(store, data, m,
          { home_score: r.home_score, away_score: r.away_score, home_penalties: r.home_penalties, away_penalties: r.away_penalties },
          r.events.map(({ team_id, player_id, type, minute }) => ({ team_id, player_id, type, minute })), isOrganizer);
        ok++; if (res.queued) queued++;
        if (res.created.length) toast.show({ tone: "info", title: `${label(m)}: se creó ${res.created.map((s) => STAGE_LABEL[s]).join(" y ")}` });
      } catch (e) {
        failed.push(r.match_id);
        toast.error(e, label(m));
      }
      setSaving((s) => s && { ...s, done: s.done + 1 });
    }
    setSaving(null);
    if (ok) toast.show({ tone: queued ? "cola" : "exito",
      title: `${ok} ${isOrganizer ? "resultado(s) publicado(s)" : "planilla(s) enviada(s) para revisión"}`,
      detail: queued ? "Sin conexión: se enviarán al recuperar la señal." : undefined });
    if (failed.length) setReview((r) => r.filter((x) => failed.includes(x.match_id)));
    else router.push("/admin");
  };

  const blocked = review.some((r) => {
    const m = matchOf(r.match_id);
    return r.include && !["liga", "grupo"].includes(m.stage) && r.home_score === r.away_score
      && (r.home_penalties == null || r.away_penalties == null || r.home_penalties === r.away_penalties);
  });
  const missing = result ? selected.filter((m) => !result.results.some((r) => r.match_id === m.id)) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Asistente de planilla" subtitle={isOrganizer ? "Dicta o envía foto: el asistente llena todo y tú solo revisas." : "Lo que envíes queda pendiente hasta que el organizador lo apruebe."} />
      <Steps steps={["Partidos", "Dictar o foto", "Revisar"]} current={step} />

      {step === 0 && (
        <div className="fade-up space-y-4">
          {days.length === 0 ? <EmptyState title="No hay partidos pendientes" text="Todos los partidos programados ya tienen resultado." /> : (
            <>
              <div role="tablist" aria-label="Jornada" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {days.map((d) => {
                  const first = pending.find((m) => dayKey(m.scheduled_at) === d);
                  return <button key={d} role="tab" aria-selected={d === activeDay} className="chip" onClick={() => { setDay(d); setExcluded([]); }}>
                    {d === "sin-fecha" ? "Sin fecha" : relativeDay(first?.scheduled_at)}</button>;
                })}
              </div>
              <Card>
                <p className="mb-2 text-sm text-[var(--muted)]">Partidos de esta jornada que vas a reportar:</p>
                <ul className="space-y-2">
                  {dayMatches.map((m) => {
                    const on = !excluded.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button aria-pressed={on} onClick={() => setExcluded((x) => on ? [...x, m.id] : x.filter((y) => y !== m.id))}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] opacity-60"}`}>
                          <span className={`grid size-6 shrink-0 place-items-center rounded-md border ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)]"}`}>{on && <Check className="size-4" />}</span>
                          <Crest team={teams.get(m.home_team_id!)} size={24} /><span className="flex-1 truncate text-sm font-semibold">{label(m)}</span>
                          <span className="text-xs text-[var(--muted)]">{fmtTime(m.scheduled_at)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <button className="btn btn-primary w-full" disabled={selected.length === 0} onClick={() => setStep(1)}>Continuar con {selected.length} partido{selected.length !== 1 ? "s" : ""}<ArrowRight className="size-4" /></button>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="fade-up space-y-4">
          <Card className="space-y-1 text-sm">
            <p className="font-semibold">Vas a reportar:</p>
            <ul className="text-[var(--muted)]">{selected.map((m) => <li key={m.id}>• {label(m)}</li>)}</ul>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              {dict.supported ? (
                <button onClick={dict.listening ? dict.stop : dict.start} aria-pressed={dict.listening}
                  className={`grid size-16 shrink-0 place-items-center rounded-full text-white shadow-md transition-transform active:scale-95 ${dict.listening ? "bg-[var(--live)]" : "bg-[var(--brand)]"}`}
                  aria-label={dict.listening ? "Detener dictado" : "Empezar a dictar"}>
                  {dict.listening ? <MicOff className="size-7" /> : <Mic className="size-7" />}
                </button>
              ) : null}
              <div className="text-sm">
                <p className="font-semibold">{dict.listening ? <span className="flex items-center gap-2"><span className="live-dot size-2 rounded-full bg-[var(--live)]" />Escuchando… habla con calma</span> : dict.supported ? "Toca el micrófono y dicta" : "Escribe el resultado"}</p>
                <p className="text-[var(--muted)]">Ej.: «Halcones 3 Toros 1. Goles de Camilo, dos de Andrés. Amarilla al 7 de Toros».</p>
              </div>
            </div>
            {dict.error && <p className="text-sm text-[var(--warning)]">{dict.error.message}</p>}
            <label className="sr-only" htmlFor="dictado">Texto del resultado</label>
            <textarea id="dictado" className="input min-h-28" value={text + (dict.interim ? ` ${dict.interim}` : "")} onChange={(e) => setText(e.target.value)}
              placeholder="También puedes escribir aquí o usar el micrófono del teclado." maxLength={4000} />
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold">Foto de la planilla <span className="font-normal text-[var(--muted)]">(opcional, hasta 3)</span></p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Foto ${i + 1}`} className="size-20 rounded-lg object-cover" />
                  <button className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[var(--danger)] text-white" aria-label={`Quitar foto ${i + 1}`} onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}><X className="size-4" /></button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]">
                  <span className="flex flex-col items-center text-xs"><Camera className="size-6" />Foto</span>
                  <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void addPhotos(e.target.files)} />
                </label>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">Toma la foto de frente, con buena luz y la hoja completa.</p>
          </Card>

          {readError && <p role="alert" className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-[var(--warning)]"><TriangleAlert className="size-4 shrink-0" />{readError}</p>}
          <div className="flex gap-2">
            {!fixed && <button className="btn btn-outline" onClick={() => setStep(0)}><ArrowLeft className="size-4" />Atrás</button>}
            <SubmitButton busy={reading} className="btn-primary flex-1" disabled={!text.trim() && photos.length === 0} onClick={read}>
              {reading ? "Leyendo…" : <><Sparkles className="size-4" />Llenar formulario</>}
            </SubmitButton>
          </div>
          <p className="text-center text-xs text-[var(--muted)]">Nada se guarda hasta que revises y confirmes.</p>
        </div>
      )}

      {step === 2 && result && (
        <div className="fade-up space-y-4">
          <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Badge tone={result.source === "ia" ? "brand" : "neutral"}><Sparkles className="size-3" />{result.source === "ia" ? "Leído con IA" : "Lector básico sin IA"}</Badge>
            Corrige lo que haga falta.
          </p>
          {review.map((r, i) => <ReviewCard key={r.match_id} r={r} m={matchOf(r.match_id)} onChange={(p) => patch(i, p)} />)}
          {missing.length > 0 && (
            <Card className="text-sm">
              <p className="font-semibold">No encontrados en el dictado o la foto:</p>
              <ul className="text-[var(--muted)]">{missing.map((m) => <li key={m.id}>• {label(m)}</li>)}</ul>
            </Card>
          )}
          {result.not_understood && <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm"><b>No entendí:</b> {result.not_understood}</p>}
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" />Volver a dictar</button>
            <SubmitButton busy={Boolean(saving)} className="btn-accent flex-1" disabled={!review.some((r) => r.include) || blocked} onClick={saveAll}>
              {saving ? `Guardando ${saving.done}/${saving.total}` : `${isOrganizer ? "Publicar" : "Enviar"} ${review.filter((r) => r.include).length} resultado(s)`}
            </SubmitButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tarjeta de revisión: edición simple de marcador y planilla. */
function ReviewCard({ r, m, onChange }: { r: Review; m: Match; onChange: (p: Partial<Review>) => void }) {
  const { data, teams } = usePublic();
  const home = teams.get(m.home_team_id!), away = teams.get(m.away_team_id!);
  const knockout = !["liga", "grupo"].includes(m.stage);
  const roster = [home, away].map((t) => ({ t, players: data.players.filter((p) => p.team_id === t?.id && p.active).sort((a, b) => (a.number ?? 99) - (b.number ?? 99)) }));
  const hasGoals = r.events.some((e) => e.type === "gol" || e.type === "autogol");
  const mismatch = hasGoals && (goalsFromEvents(r.events, home!.id) !== r.home_score || goalsFromEvents(r.events, away!.id) !== r.away_score);
  const needPens = knockout && r.home_score === r.away_score && (r.home_penalties == null || r.away_penalties == null || r.home_penalties === r.away_penalties);
  const setEvent = (k: number, p: Partial<Review["events"][number]>) => onChange({ events: r.events.map((e, j) => (j === k ? { ...e, ...p } : e)) });
  const scoreInput = (v: number, set: (n: number) => void, name: string) => (
    <input type="number" inputMode="numeric" min={0} max={99} aria-label={`Goles de ${name}`} value={v}
      onChange={(e) => set(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
      className="input font-display tabular w-16 text-center text-2xl font-extrabold" />
  );

  return (
    <Card className={`space-y-3 ${r.include ? "" : "opacity-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={CONF[r.confidence].tone}>{CONF[r.confidence].l}</Badge>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={r.include} onChange={(e) => onChange({ include: e.target.checked })} />Incluir</label>
      </div>
      <div className="space-y-2">
        {[{ t: home!, v: r.home_score, k: "home_score" as const }, { t: away!, v: r.away_score, k: "away_score" as const }].map(({ t, v, k }) => (
          <div key={k} className="flex items-center gap-3">
            <Crest team={t} size={30} />
            <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
            {scoreInput(v, (n) => onChange({ [k]: n } as Partial<Review>), t.name)}
          </div>
        ))}
      </div>
      {knockout && r.home_score === r.away_score && (
        <div className="flex items-center justify-center gap-2 text-sm">
          Penales
          <input type="number" min={0} className="input w-16 text-center" aria-label={`Penales ${home?.name}`} value={r.home_penalties ?? ""} onChange={(e) => onChange({ home_penalties: e.target.value === "" ? null : Number(e.target.value) })} />
          -
          <input type="number" min={0} className="input w-16 text-center" aria-label={`Penales ${away?.name}`} value={r.away_penalties ?? ""} onChange={(e) => onChange({ away_penalties: e.target.value === "" ? null : Number(e.target.value) })} />
        </div>
      )}
      {r.note && <p className="text-xs text-[var(--muted)]">Nota: {r.note}</p>}

      {r.events.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {r.events.map((e, k) => (
            <li key={k} className="flex items-center gap-2 p-2">
              <EventIcon type={e.type} />
              <select className="input h-9 min-h-0 w-28 py-0 text-sm" aria-label="Tipo" value={e.type} onChange={(ev) => setEvent(k, { type: ev.target.value as EventType })}>
                {Object.entries(EVENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="input h-9 min-h-0 flex-1 py-0 text-sm" aria-label="Jugador"
                value={e.player_id ?? `team:${e.team_id}`}
                onChange={(ev) => {
                  const v = ev.target.value;
                  if (v.startsWith("team:")) setEvent(k, { player_id: null, team_id: v.slice(5) });
                  else setEvent(k, { player_id: v, team_id: data.players.find((p) => p.id === v)!.team_id, player_raw: null });
                }}>
                {roster.map(({ t, players }) => (
                  <optgroup key={t!.id} label={t!.name}>
                    <option value={`team:${t!.id}`}>{e.player_raw && e.team_id === t!.id ? `¿${e.player_raw}? (sin identificar)` : "Sin identificar"}</option>
                    {players.map((p) => <option key={p.id} value={p.id}>{p.number ?? "–"} · {p.full_name}</option>)}
                  </optgroup>
                ))}
              </select>
              <button className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--danger)]" aria-label="Quitar evento" onClick={() => onChange({ events: r.events.filter((_, j) => j !== k) })}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost h-9 min-h-0 px-2 text-sm" onClick={() => onChange({ events: [...r.events, { team_id: home!.id, player_id: null, player_raw: null, type: "gol", minute: null }] })}>
        <Plus className="size-4" />Agregar evento
      </button>
      {mismatch && <p className="text-sm text-[var(--warning)]">Los goles de la planilla ({goalsFromEvents(r.events, home!.id)}-{goalsFromEvents(r.events, away!.id)}) no coinciden con el marcador.</p>}
      {needPens && r.include && <p className="text-sm text-[var(--warning)]">Empate en eliminatoria: faltan los penales para saber quién avanza.</p>}
      <p className="text-xs text-[var(--muted)]">{fmtDate(m.scheduled_at)} · {m.stage === "grupo" ? `Grupo ${m.group_label} · Fecha ${m.round}` : m.stage === "liga" ? `Fecha ${m.round}` : STAGE_LABEL[m.stage]}</p>
    </Card>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin" /></div>}><Asistente /></Suspense>;
}
