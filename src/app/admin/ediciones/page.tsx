"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Lock, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Card, ConfirmButton, Field, Steps, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { FORMATS } from "@/lib/domain/formats";
import { categoryView } from "@/lib/data/selectors";
import { useStore } from "@/lib/data/store";
import { BRANCH_LABEL, EDITION_STATUS_LABEL } from "@/lib/format";
import type { Branch, Category, Edition, EditionStatus, Format } from "@/lib/types";
import { editionSchema, fieldErrors } from "@/lib/validation";

const STATUS_ORDER: EditionStatus[] = ["planificacion", "inscripcion", "en_desarrollo", "finalizado"];
const STATUS_HELP: Record<EditionStatus, string> = {
  planificacion: "Solo el comité la ve en gestión; se configura con calma.",
  inscripcion: "Se inscriben equipos y delegados actualizan plantillas.",
  en_desarrollo: "Se juegan los partidos y se registran resultados.",
  finalizado: "Se guarda el podio y el historial queda protegido.",
};

function Ediciones() {
  const params = useSearchParams();
  const { data, ready } = usePublic();
  if (!ready) return <ListSkeleton />;
  if (params.get("nueva")) return <NewEditionWizard />;
  const id = params.get("id");
  const ed = id ? data.editions.find((e) => e.id === id) : null;
  if (id && ed) return <EditionDetail edition={ed} />;

  const list = [...data.editions].sort((a, b) => b.year - a.year);
  return (
    <div className="space-y-4">
      <PageHeader title="Ediciones" action={<Link href="/admin/ediciones?nueva=1" className="btn btn-primary"><Plus className="size-4" />Nueva</Link>} />
      {list.length === 0 ? <EmptyState title="Sin ediciones" text="Crea la primera para empezar." /> : (
        <ul className="card divide-y divide-[var(--border)]">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/ediciones?id=${e.id}`} className="flex items-center gap-3 p-4 hover:bg-[var(--surface-2)]">
                <span className="font-display text-2xl font-extrabold text-[var(--brand)]">{e.year}</span>
                <span className="flex-1"><span className="block font-semibold">{e.name}</span>
                  <span className="text-sm text-[var(--muted)]">{data.categories.filter((c) => c.edition_id === e.id).length} categorías</span></span>
                <Badge tone={e.status === "finalizado" ? "neutral" : "accent"}>{e.status === "finalizado" && <Lock className="size-3" />}{EDITION_STATUS_LABEL[e.status]}</Badge>
                <ChevronRight className="size-4 text-[var(--muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type CatDraft = { key: string; sport_id: string; branch: Branch; name: string; format: Format; reuseFrom?: Category };

function NewEditionWizard() {
  const { data } = usePublic();
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const prev = useMemo(() => [...data.editions].sort((a, b) => b.year - a.year)[0], [data.editions]);
  const year = (prev?.year ?? new Date().getFullYear() - 1) + 1;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: `Copa Arrayanes ${year}`, year: String(year), start_date: "", end_date: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prevCats = data.categories.filter((c) => c.edition_id === prev?.id);
  const [cats, setCats] = useState<CatDraft[]>(() => prevCats.map((c) => ({ key: c.id, sport_id: c.sport_id, branch: c.branch, name: c.name, format: c.format, reuseFrom: c })));
  const [busy, setBusy] = useState(false);

  const next0 = () => {
    const r = editionSchema.safeParse(form);
    if (!r.success) { setErrors(fieldErrors(r.error)); return; }
    if (data.editions.some((e) => e.year === r.data.year)) { setErrors({ year: `Ya existe una edición ${r.data.year}` }); return; }
    setErrors({}); setStep(1);
  };

  const addCat = (branch: Branch) => setCats((c) => [...c, { key: crypto.randomUUID(), sport_id: "microfutbol", branch, name: `Microfútbol ${BRANCH_LABEL[branch]}`, format: "grupos" }]);

  const create = async () => {
    const parsed = editionSchema.parse(form);
    const editionId = crypto.randomUUID();
    setBusy(true);
    try {
      await store.insert("editions", [{ id: editionId, ...parsed, status: "planificacion", based_on: prev?.id ?? null }], "Edición");
      if (cats.length) {
        await store.insert("categories", cats.map((c) => {
          const preset = FORMATS[c.format];
          const base = c.reuseFrom;
          return {
            edition_id: editionId, sport_id: c.sport_id, branch: c.branch, name: c.name.trim(), format: c.format,
            group_count: base?.group_count ?? preset.groupCount, knockout_size: base?.knockout_size ?? preset.knockoutSize,
            third_place: base?.third_place ?? true, points_win: base?.points_win ?? 3, points_draw: base?.points_draw ?? 1,
            points_loss: base?.points_loss ?? 0, tiebreakers: base?.tiebreakers ?? ["puntos", "diferencia", "juego_limpio", "goles_favor"],
          };
        }), "Categorías");
      }
      toast.show({ tone: "exito", title: `${parsed.name} creada`, detail: "Ahora inscribe los equipos en cada categoría." });
      router.replace(`/admin/ediciones?id=${editionId}`);
    } catch (e) { toast.error(e, "No se creó la edición"); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/ediciones" className="btn btn-ghost -ml-3 mb-2 px-3"><ArrowLeft className="size-4" />Ediciones</Link>
      <PageHeader title="Nueva edición" />
      <Steps steps={["Datos", "Categorías", "Confirmar"]} current={step} />

      {step === 0 && (
        <Card className="fade-up space-y-4">
          <Field label="Nombre" error={errors.name}>{(p) => <input {...p} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Año" error={errors.year}>{(p) => <input {...p} className="input" type="number" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio" optional error={errors.start_date}>{(p) => <input {...p} className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}</Field>
            <Field label="Final" optional error={errors.end_date}>{(p) => <input {...p} className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}</Field>
          </div>
          <button className="btn btn-primary w-full" onClick={next0}>Continuar<ArrowRight className="size-4" /></button>
        </Card>
      )}

      {step === 1 && (
        <div className="fade-up space-y-3">
          {prev && prevCats.length > 0 && <p className="text-sm text-[var(--muted)]">Copiamos la configuración de {prev.name}. <b>No</b> se copian equipos inscritos, jugadores ni resultados.</p>}
          {cats.map((c, i) => (
            <Card key={c.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <input className="input font-semibold" aria-label="Nombre de la categoría" value={c.name} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <button className="btn btn-ghost text-[var(--danger)]" onClick={() => setCats(cats.filter((_, j) => j !== i))}>Quitar</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" aria-label="Rama" value={c.branch} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, branch: e.target.value as Branch } : x))}>
                  {Object.entries(BRANCH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select className="input" aria-label="Formato" value={c.format} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, format: e.target.value as Format, reuseFrom: undefined } : x))}>
                  {Object.entries(FORMATS).map(([v, f]) => <option key={v} value={v}>{f.label}</option>)}
                </select>
              </div>
              <p className="text-xs text-[var(--muted)]">{FORMATS[c.format].description}</p>
            </Card>
          ))}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BRANCH_LABEL) as Branch[]).map((b) => <button key={b} className="chip" onClick={() => addCat(b)}><Plus className="size-3.5" />{BRANCH_LABEL[b]}</button>)}
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn btn-outline flex-1" onClick={() => setStep(0)}><ArrowLeft className="size-4" />Atrás</button>
            <button className="btn btn-primary flex-1" disabled={cats.some((c) => c.name.trim().length < 2)} onClick={() => setStep(2)}>Revisar<ArrowRight className="size-4" /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card className="fade-up space-y-3">
          <p className="font-display text-xl font-bold">{form.name}</p>
          <ul className="list-disc pl-5 text-sm">
            {cats.map((c) => <li key={c.key}>{c.name} · {FORMATS[c.format].label}</li>)}
            {cats.length === 0 && <li>Sin categorías (podrás agregarlas después)</li>}
          </ul>
          <p className="text-sm text-[var(--muted)]">Empieza en estado <b>Planificación</b>.</p>
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => setStep(1)}><ArrowLeft className="size-4" />Atrás</button>
            <SubmitButton busy={busy} className="btn-accent flex-1" onClick={create}>Crear edición</SubmitButton>
          </div>
        </Card>
      )}
    </div>
  );
}

function EditionDetail({ edition: e }: { edition: Edition }) {
  const { data } = usePublic(e.id);
  const store = useStore();
  const toast = useToast();
  const cats = data.categories.filter((c) => c.edition_id === e.id);
  const closed = e.status === "finalizado";
  const isAdmin = store.profile?.role === "admin";
  const [newCat, setNewCat] = useState<{ branch: Branch; format: Format } | null>(null);

  const setStatus = async (status: EditionStatus) => {
    try { toast.saved(await store.update("editions", { id: e.id }, { status }, "Estado"), `Estado: ${EDITION_STATUS_LABEL[status]}`); }
    catch (err) { toast.error(err, "No se cambió el estado"); }
  };

  /** Cerrar edición: guarda el podio calculado de cada categoría y bloquea cambios. */
  const close = async () => {
    try {
      const rows = cats.flatMap((c) => {
        const v = categoryView(data, c);
        if (data.category_podium.some((p) => p.category_id === c.id)) return [];
        return v.podium.map((team_id, i) => team_id ? { category_id: c.id, position: (i + 1) as 1 | 2 | 3 | 4, team_id } : null).filter(Boolean) as Array<{ category_id: string; position: 1 | 2 | 3 | 4; team_id: string }>;
      });
      if (rows.length) await store.insert("category_podium", rows, "Podio");
      await setStatus("finalizado");
    } catch (err) { toast.error(err, "No se pudo cerrar"); }
  };

  const pendingMatches = data.matches.filter((m) => cats.some((c) => c.id === m.category_id) && !["finalizado", "cancelado"].includes(m.status)).length;

  const addCategory = async () => {
    if (!newCat) return;
    const name = `Microfútbol ${BRANCH_LABEL[newCat.branch]}`;
    const f = FORMATS[newCat.format];
    try {
      const r = await store.insert("categories", [{ edition_id: e.id, sport_id: "microfutbol", branch: newCat.branch, name: cats.some((c) => c.name === name) ? `${name} ${cats.length + 1}` : name, format: newCat.format, group_count: f.groupCount, knockout_size: f.knockoutSize }], "Categoría");
      toast.saved(r, "Categoría"); setNewCat(null);
    } catch (err) { toast.error(err, "No se creó la categoría"); }
  };

  return (
    <div className="space-y-5">
      <Link href="/admin/ediciones" className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Ediciones</Link>
      <PageHeader title={e.name} subtitle={closed ? "Finalizada: historial protegido" : undefined} />

      <Section title="Estado">
        <Card>
          <ol className="grid gap-2 sm:grid-cols-4">
            {STATUS_ORDER.map((s, i) => {
              const current = s === e.status;
              const reachable = !closed ? s !== "finalizado" : isAdmin;
              return (
                <li key={s}>
                  <button disabled={current || !reachable} onClick={() => setStatus(s)} aria-current={current ? "step" : undefined}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${current ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)] disabled:opacity-50"}`}>
                    <span className="text-xs text-[var(--muted)]">Paso {i + 1}</span>
                    <span className="block font-semibold">{EDITION_STATUS_LABEL[s]}</span>
                    <span className="block text-xs text-[var(--muted)]">{STATUS_HELP[s]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!closed && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
              <ConfirmButton onConfirm={close} confirmText="Confirmar: cerrar y proteger" disabled={pendingMatches > 0}><Lock className="size-4" />Finalizar edición</ConfirmButton>
              <p className="text-sm text-[var(--muted)]">{pendingMatches > 0 ? `Faltan ${pendingMatches} partidos por jugar o cancelar.` : "Se guardará el podio de cada categoría."}</p>
            </div>
          )}
        </Card>
      </Section>

      <Section title="Categorías" action={!closed && <button className="btn btn-outline px-3 text-sm" onClick={() => setNewCat({ branch: "femenino", format: "todos_contra_todos" })}><Plus className="size-4" />Agregar</button>}>
        {newCat && (
          <Card className="mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select className="input" aria-label="Rama" value={newCat.branch} onChange={(ev) => setNewCat({ ...newCat, branch: ev.target.value as Branch })}>
                {Object.entries(BRANCH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="input" aria-label="Formato" value={newCat.format} onChange={(ev) => setNewCat({ ...newCat, format: ev.target.value as Format })}>
                {Object.entries(FORMATS).map(([v, f]) => <option key={v} value={v}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setNewCat(null)}>Cancelar</button><button className="btn btn-primary" onClick={addCategory}>Crear categoría</button></div>
          </Card>
        )}
        {cats.length === 0 ? <EmptyState title="Sin categorías" /> : (
          <ul className="card divide-y divide-[var(--border)]">
            {cats.map((c) => {
              const n = data.category_teams.filter((x) => x.category_id === c.id).length;
              const ms = data.matches.filter((m) => m.category_id === c.id);
              return (
                <li key={c.id}>
                  <Link href={`/admin/categoria?id=${c.id}`} className="flex items-center gap-3 p-4 hover:bg-[var(--surface-2)]">
                    <span className="flex-1"><span className="block font-semibold">{c.name}</span>
                      <span className="text-sm text-[var(--muted)]">{FORMATS[c.format].label} · {n} equipos · {ms.filter((m) => m.status === "finalizado").length}/{ms.length} partidos jugados</span></span>
                    <ChevronRight className="size-4 text-[var(--muted)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><Ediciones /></Suspense>;
}
