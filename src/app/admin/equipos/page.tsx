"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Plus, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Crest } from "@/components/crest";
import { Card, Field, Steps, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui";
import { getBackend, useStore } from "@/lib/data/store";
import { compressImage } from "@/lib/image";
import type { CrestShape, Team } from "@/lib/types";
import { fieldErrors, teamSchema } from "@/lib/validation";

const SHAPES: Array<{ v: CrestShape; l: string }> = [{ v: "escudo", l: "Escudo" }, { v: "circulo", l: "Círculo" }, { v: "hexagono", l: "Hexágono" }, { v: "diamante", l: "Diamante" }];
const SWATCHES = ["#1d4ed8", "#15803d", "#0f172a", "#b91c1c", "#0e7490", "#7c3aed", "#ea580c", "#ffffff", "#facc15", "#be185d", "#334155", "#16a34a"];

function EquiposAdmin() {
  const params = useSearchParams();
  const { data, ready } = usePublic();
  const { profile } = useStore();
  if (!ready) return <ListSkeleton />;
  if (params.get("nuevo")) return <TeamWizard />;
  const editId = params.get("editar");
  if (editId) {
    const t = data.teams.find((x) => x.id === editId);
    return t ? <TeamWizard team={t} /> : <EmptyState title="Equipo no encontrado" />;
  }
  const isOrg = profile?.role === "admin" || profile?.role === "organizador";
  const list = data.teams.filter((t) => isOrg || t.id === profile?.team_id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      <PageHeader title="Equipos" subtitle="Los equipos se conservan entre ediciones." action={isOrg && <Link href="/admin/equipos?nuevo=1" className="btn btn-primary"><Plus className="size-4" />Nuevo</Link>} />
      {list.length === 0 ? <EmptyState title="Sin equipos" /> : (
        <ul className="card divide-y divide-[var(--border)]">
          {list.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/equipo?id=${t.id}`} className="flex items-center gap-3 p-3 hover:bg-[var(--surface-2)]">
                <Crest team={t} size={36} />
                <span className="flex-1"><span className="block font-semibold">{t.name}</span>
                  <span className="text-sm text-[var(--muted)]">{data.players.filter((p) => p.team_id === t.id && p.active).length} jugadores · {data.veredas.find((v) => v.id === t.vereda_id)?.name ?? "Sin vereda"}</span></span>
                <ChevronRight className="size-4 text-[var(--muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Crear/editar equipo en 2 pasos: datos → escudo. */
function TeamWizard({ team }: { team?: Team }) {
  const { data } = usePublic();
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: team?.name ?? "", short_name: team?.short_name ?? "", vereda_id: team?.vereda_id ?? "",
    crest_shape: team?.crest_shape ?? ("escudo" as CrestShape), color_primary: team?.color_primary ?? "#1d4ed8", color_secondary: team?.color_secondary ?? "#ffffff",
  });
  const [crestUrl, setCrestUrl] = useState<string | null>(team?.crest_url ?? null);
  const [newVereda, setNewVereda] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const next = () => {
    const r = teamSchema.safeParse(f);
    if (!r.success) { setErrors(fieldErrors(r.error)); return; }
    const dup = data.teams.find((t) => t.id !== team?.id && t.name.trim().toLowerCase() === f.name.trim().toLowerCase());
    if (dup) { setErrors({ name: "Ya existe un equipo con ese nombre" }); return; }
    setErrors({}); setStep(1);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file, 256, 0.85);
      const url = await getBackend().uploadImage("escudos", blob, `${team?.id ?? crypto.randomUUID()}-${Date.now()}.webp`);
      setCrestUrl(url);
    } catch (e) { toast.error(e, "No se subió el escudo"); } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      let vereda_id = f.vereda_id || null;
      if (vereda_id === "__nueva") {
        vereda_id = crypto.randomUUID();
        await store.insert("veredas", [{ id: vereda_id, name: newVereda.trim(), municipality: "Córdoba (Nariño)" }], "Vereda");
      }
      const row = { ...teamSchema.parse({ ...f, vereda_id: vereda_id ?? "" }), crest_url: crestUrl };
      if (team) {
        toast.saved(await store.update("teams", { id: team.id }, row, "Equipo"), "Equipo");
        router.replace(`/admin/equipo?id=${team.id}`);
      } else {
        const id = crypto.randomUUID();
        toast.saved(await store.insert("teams", [{ id, ...row }], "Equipo"), "Equipo creado");
        router.replace(`/admin/equipo?id=${id}`);
      }
    } catch (e) { toast.error(e, "No se guardó el equipo"); } finally { setBusy(false); }
  };

  const preview = { ...f, short_name: f.short_name || null, crest_url: crestUrl };

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => router.back()} className="btn btn-ghost -ml-3 mb-2 px-3"><ArrowLeft className="size-4" />Volver</button>
      <PageHeader title={team ? `Editar ${team.name}` : "Nuevo equipo"} />
      <Steps steps={["Datos", "Escudo"]} current={step} />
      {step === 0 ? (
        <Card className="fade-up space-y-4">
          <Field label="Nombre del equipo" error={errors.name}>{(p) => <input {...p} className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} />}</Field>
          <Field label="Abreviatura" optional hint="2 a 4 letras. Va dentro del escudo." error={errors.short_name}>{(p) => <input {...p} className="input uppercase" value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} maxLength={4} />}</Field>
          <Field label="Vereda" optional hint="Permite que la gente siga a toda su vereda.">{(p) => (
            <select {...p} className="input" value={f.vereda_id} onChange={(e) => setF({ ...f, vereda_id: e.target.value })}>
              <option value="">Sin vereda</option>
              {data.veredas.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="__nueva">+ Agregar vereda…</option>
            </select>)}</Field>
          {f.vereda_id === "__nueva" && <Field label="Nombre de la nueva vereda">{(p) => <input {...p} className="input" value={newVereda} onChange={(e) => setNewVereda(e.target.value)} />}</Field>}
          <button className="btn btn-primary w-full" disabled={f.vereda_id === "__nueva" && newVereda.trim().length < 2} onClick={next}>Continuar<ArrowRight className="size-4" /></button>
        </Card>
      ) : (
        <Card className="fade-up space-y-5">
          <div className="flex justify-center"><Crest team={preview} size={112} /></div>
          {!crestUrl && (
            <>
              <fieldset><legend className="mb-2 text-sm font-semibold">Forma</legend>
                <div className="flex flex-wrap gap-2">{SHAPES.map((s) => <button key={s.v} className="chip" aria-pressed={f.crest_shape === s.v} onClick={() => setF({ ...f, crest_shape: s.v })}>{s.l}</button>)}</div>
              </fieldset>
              {(["color_primary", "color_secondary"] as const).map((k) => (
                <fieldset key={k}><legend className="mb-2 text-sm font-semibold">{k === "color_primary" ? "Color principal" : "Color de letras y borde"}</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    {SWATCHES.map((c) => <button key={c} aria-label={c} aria-pressed={f[k] === c} onClick={() => setF({ ...f, [k]: c })}
                      className={`size-9 rounded-full border-2 ${f[k] === c ? "border-[var(--ring)] ring-2 ring-[var(--ring)]/30" : "border-[var(--border)]"}`} style={{ background: c }} />)}
                    <input type="color" aria-label="Otro color" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="size-9 cursor-pointer rounded-full border-0 bg-transparent" />
                  </div>
                </fieldset>
              ))}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-outline cursor-pointer"><Upload className="size-4" />{crestUrl ? "Cambiar foto" : "Subir foto del escudo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} /></label>
            {crestUrl && <button className="btn btn-ghost" onClick={() => setCrestUrl(null)}>Usar escudo diseñado</button>}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => setStep(0)}><ArrowLeft className="size-4" />Atrás</button>
            <SubmitButton busy={busy} className="btn-accent flex-1" onClick={save}>{team ? "Guardar cambios" : "Crear equipo"}</SubmitButton>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><EquiposAdmin /></Suspense>;
}
