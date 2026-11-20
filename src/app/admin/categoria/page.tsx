"use client";

import Link from "next/link";
import { ArrowLeft, Check, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { Card, ConfirmButton, Field, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { StandingsTable } from "@/components/standings";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { generateGroupStage, generateKnockoutRound, seedKnockout, splitIntoGroups } from "@/lib/domain/fixtures";
import { FORMATS, GROUP_LABELS, STAGE_LABEL } from "@/lib/domain/formats";
import { TIEBREAKER_LABEL } from "@/lib/domain/standings";
import { categoryView } from "@/lib/data/selectors";
import { useStore } from "@/lib/data/store";
import { localInputToIso } from "@/lib/format";
import type { Category, Format } from "@/lib/types";

function CategoriaAdmin() {
  const id = useSearchParams().get("id");
  const { data, ready, teams } = usePublic();
  const store = useStore();
  const toast = useToast();
  const cat = data.categories.find((c) => c.id === id);
  const view = useMemo(() => (cat ? categoryView(data, cat) : null), [data, cat]);
  const [startAt, setStartAt] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <ListSkeleton />;
  if (!cat || !view) return <EmptyState title="Categoría no encontrada" />;
  const edition = data.editions.find((e) => e.id === cat.edition_id)!;
  const closed = edition.status === "finalizado";
  const enrolled = data.category_teams.filter((x) => x.category_id === cat.id);
  const enrolledIds = new Set(enrolled.map((x) => x.team_id));
  const groupMatches = view.matches.filter((m) => m.stage === "liga" || m.stage === "grupo");
  const groupDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === "finalizado" || m.status === "cancelado");
  const multiGroup = cat.group_count > 1;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); toast.show({ tone: "exito", title: label }); } catch (e) { toast.error(e, "No se completó"); } finally { setBusy(false); }
  };

  const toggleTeam = (teamId: string) => run(enrolledIds.has(teamId) ? "Equipo retirado" : "Equipo inscrito", () =>
    enrolledIds.has(teamId)
      ? store.remove("category_teams", { category_id: cat.id, team_id: teamId }, "Inscripción")
      : store.insert("category_teams", [{ category_id: cat.id, team_id: teamId, group_label: null }], "Inscripción"));

  const autoGroups = () => run("Grupos sorteados", async () => {
    const shuffled = [...enrolledIds].sort(() => Math.random() - 0.5);
    const groups = splitIntoGroups(shuffled, cat.group_count);
    for (const [label, ids] of Object.entries(groups)) {
      for (const tid of ids) await store.update("category_teams", { category_id: cat.id, team_id: tid }, { group_label: label }, "Grupo");
    }
  });

  const setGroup = (teamId: string, label: string) =>
    store.update("category_teams", { category_id: cat.id, team_id: teamId }, { group_label: label || null }, "Grupo").catch((e) => toast.error(e));

  const generate = () => run("Calendario generado", async () => {
    const groups: Record<string, string[]> = {};
    if (multiGroup) for (const ct of enrolled) (groups[ct.group_label ?? "A"] ??= []).push(ct.team_id);
    else groups.A = enrolled.map((x) => x.team_id);
    const drafts = generateGroupStage(cat.id, groups);
    // Fechas sugeridas: una fecha por semana desde el inicio indicado
    const base = localInputToIso(startAt);
    const rows = drafts.map((d) => ({ ...d, scheduled_at: base ? new Date(Date.parse(base) + (d.round - 1) * 7 * 864e5).toISOString() : null }));
    await store.insert("matches", rows, "Calendario");
  });

  const removeSchedule = () => run("Calendario eliminado", async () => {
    for (const m of groupMatches) await store.remove("matches", { id: m.id }, "Partido");
  });

  const qualified = () => {
    const per = Math.max(1, Math.floor(cat.knockout_size / view.groups.length));
    return Object.fromEntries(view.groups.map((g, i) => [g.label ?? GROUP_LABELS[i], g.rows.slice(0, per).map((r) => r.teamId)]));
  };

  const generateFinal = () => run("Fase final creada", async () => {
    const pairs = seedKnockout(qualified(), cat.knockout_size);
    const round = Math.max(0, ...view.matches.map((m) => m.round)) + 1;
    await store.insert("matches", generateKnockoutRound(cat.id, pairs, round), "Fase final");
  });

  const possibleGroupMatches = multiGroup
    ? [...new Set(enrolled.map((x) => x.group_label))].reduce((s, g) => { const n = enrolled.filter((x) => x.group_label === g).length; return s + (n * (n - 1)) / 2; }, 0)
    : (enrolled.length * (enrolled.length - 1)) / 2;
  const ungrouped = multiGroup && enrolled.some((x) => !x.group_label);

  return (
    <div className="space-y-6">
      <Link href={`/admin/ediciones?id=${edition.id}`} className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />{edition.name}</Link>
      <PageHeader title={cat.name} subtitle={`${FORMATS[cat.format].label} · ${enrolled.length} equipos`} />
      {closed && <EmptyState title="Edición finalizada" text="Solo lectura." />}

      {!closed && (
        <>
          <Section title="1. Equipos inscritos" action={<Link href="/admin/equipos?nuevo=1" className="text-sm font-semibold text-[var(--brand)]">Crear equipo</Link>}>
            {groupMatches.length > 0 && <p className="mb-2 text-sm text-[var(--muted)]">Ya hay calendario. Para cambiar equipos, elimina primero el calendario.</p>}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => {
                const on = enrolledIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button disabled={busy || groupMatches.length > 0} onClick={() => toggleTeam(t.id)} aria-pressed={on}
                      className={`card flex w-full items-center gap-3 p-2.5 text-left transition-colors disabled:opacity-60 ${on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
                      <Crest team={t} size={30} /><span className="flex-1 truncate text-sm font-semibold">{t.name}</span>
                      <span className={`grid size-6 place-items-center rounded-md border ${on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)]"}`}>{on && <Check className="size-4" />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          {multiGroup && (
            <Section title={`2. Grupos (${cat.group_count})`} action={groupMatches.length === 0 && enrolled.length >= 2 && <button className="btn btn-outline px-3 text-sm" disabled={busy} onClick={autoGroups}><Shuffle className="size-4" />Sortear</button>}>
              <Card>
                <ul className="divide-y divide-[var(--border)]">
                  {enrolled.map((ct) => (
                    <li key={ct.team_id} className="flex items-center gap-3 py-2">
                      <Crest team={teams.get(ct.team_id)} size={26} /><span className="flex-1 truncate text-sm">{teams.get(ct.team_id)?.name}</span>
                      <select className="input w-24" aria-label="Grupo" disabled={groupMatches.length > 0} value={ct.group_label ?? ""} onChange={(e) => setGroup(ct.team_id, e.target.value)}>
                        <option value="">—</option>
                        {GROUP_LABELS.slice(0, cat.group_count).map((g) => <option key={g} value={g}>Grupo {g}</option>)}
                      </select>
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          )}

          <Section title={`${multiGroup ? 3 : 2}. Calendario de la fase regular`}>
            <Card className="space-y-3">
              {groupMatches.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="accent"><Check className="size-3" />{groupMatches.length} partidos creados</Badge>
                  <Link href={`/admin/partidos?categoria=${cat.id}`} className="btn btn-outline px-3 text-sm">Asignar fechas y horas</Link>
                  {groupMatches.every((m) => m.status === "programado") && (
                    <ConfirmButton onConfirm={removeSchedule} confirmText="Sí, eliminar calendario"><Trash2 className="size-4" />Eliminar calendario</ConfirmButton>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm">Se crearán <b>{possibleGroupMatches}</b> partidos todos contra todos{multiGroup ? " dentro de cada grupo" : ""}.</p>
                  <Field label="Primera fecha" optional hint="Las siguientes fechas se programan cada semana. Puedes ajustar cada partido después.">
                    {(p) => <input {...p} type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}
                  </Field>
                  <SubmitButton busy={busy} disabled={enrolled.length < 2 || ungrouped} onClick={generate}><Sparkles className="size-4" />Generar calendario</SubmitButton>
                  {enrolled.length < 2 && <p className="text-sm text-[var(--muted)]">Inscribe al menos 2 equipos.</p>}
                  {ungrouped && <p className="text-sm text-[var(--warning)]">Hay equipos sin grupo asignado.</p>}
                </>
              )}
            </Card>
          </Section>

          {cat.knockout_size > 0 && (
            <Section title={`${multiGroup ? 4 : 3}. Fase final`}>
              <Card className="space-y-3">
                {view.knockout.length > 0 ? (
                  <p className="text-sm">Fase final en curso: {[...new Set(view.knockout.map((m) => STAGE_LABEL[m.stage]))].join(", ")}. Las siguientes rondas se crean solas al registrar resultados.</p>
                ) : !groupDone ? (
                  <p className="text-sm text-[var(--muted)]">Clasifican {cat.knockout_size} equipos a {STAGE_LABEL[cat.knockout_size >= 8 ? "cuartos" : cat.knockout_size >= 4 ? "semifinal" : "final"].toLowerCase()}. Se habilita cuando termine la fase regular ({groupMatches.filter((m) => m.status === "finalizado").length}/{groupMatches.length}).</p>
                ) : (
                  <>
                    <p className="text-sm">Cruces según la tabla:</p>
                    <ul className="space-y-1 text-sm">
                      {seedKnockout(qualified(), cat.knockout_size).map(([a, b], i) => <li key={i} className="flex items-center gap-2"><Crest team={teams.get(a)} size={20} />{teams.get(a)?.name} <span className="text-[var(--muted)]">vs</span> <Crest team={teams.get(b)} size={20} />{teams.get(b)?.name}</li>)}
                    </ul>
                    <SubmitButton busy={busy} onClick={generateFinal}><Sparkles className="size-4" />Crear fase final</SubmitButton>
                  </>
                )}
              </Card>
            </Section>
          )}

          <CategorySettings cat={cat} locked={groupMatches.length > 0} />
        </>
      )}

      {view.groups.map((g) => g.rows.length > 0 && (
        <Section key={g.label ?? "x"} title={g.label ? `Tabla grupo ${g.label}` : "Tabla"}>
          <StandingsTable rows={g.rows} teams={teams} tiebreakers={cat.tiebreakers} />
        </Section>
      ))}
    </div>
  );
}

function CategorySettings({ cat, locked }: { cat: Category; locked: boolean }) {
  const store = useStore();
  const toast = useToast();
  const [f, setF] = useState({ format: cat.format, group_count: cat.group_count, knockout_size: cat.knockout_size, third_place: cat.third_place, points_win: cat.points_win, points_draw: cat.points_draw, name: cat.name });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { toast.saved(await store.update("categories", { id: cat.id }, f, "Configuración"), "Configuración"); }
    catch (e) { toast.error(e, "No se guardó"); } finally { setBusy(false); }
  };
  const applyPreset = (format: Format) => setF({ ...f, format, group_count: FORMATS[format].groupCount, knockout_size: FORMATS[format].knockoutSize });
  return (
    <details className="card">
      <summary className="cursor-pointer p-4 font-semibold">Configuración de la categoría</summary>
      <div className="space-y-4 border-t border-[var(--border)] p-4">
        <Field label="Nombre">{(p) => <input {...p} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Formato" hint={locked ? "Con calendario generado no se puede cambiar el formato." : FORMATS[f.format].description}>
          {(p) => <select {...p} className="input" disabled={locked} value={f.format} onChange={(e) => applyPreset(e.target.value as Format)}>{Object.entries(FORMATS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grupos">{(p) => <input {...p} type="number" min={1} max={8} disabled={locked} className="input" value={f.group_count} onChange={(e) => setF({ ...f, group_count: Math.max(1, Math.min(8, Number(e.target.value))) })} />}</Field>
          <Field label="Clasifican a fase final">{(p) => <select {...p} className="input" value={f.knockout_size} onChange={(e) => setF({ ...f, knockout_size: Number(e.target.value) })}>{[0, 2, 4, 8].map((n) => <option key={n} value={n}>{n === 0 ? "Sin fase final" : n === 2 ? "2 (final directa)" : n}</option>)}</select>}</Field>
          <Field label="Puntos por victoria">{(p) => <input {...p} type="number" min={0} className="input" value={f.points_win} onChange={(e) => setF({ ...f, points_win: Number(e.target.value) })} />}</Field>
          <Field label="Puntos por empate">{(p) => <input {...p} type="number" min={0} className="input" value={f.points_draw} onChange={(e) => setF({ ...f, points_draw: Number(e.target.value) })} />}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.third_place} onChange={(e) => setF({ ...f, third_place: e.target.checked })} />Jugar partido por el tercer puesto</label>
        <p className="text-xs text-[var(--muted)]">Desempate: {cat.tiebreakers.map((t) => TIEBREAKER_LABEL[t]).join(" › ")}</p>
        <SubmitButton busy={busy} onClick={save}>Guardar configuración</SubmitButton>
      </div>
    </details>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><CategoriaAdmin /></Suspense>;
}
