"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Plus, UserMinus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Crest } from "@/components/crest";
import { Card, ConfirmButton, Field, SubmitButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import type { Player } from "@/lib/types";
import { fieldErrors, playerSchema } from "@/lib/validation";

/** Plantilla del equipo. Delegados solo pueden editar la suya. */
function EquipoAdmin() {
  const id = useSearchParams().get("id") ?? "";
  const { data, ready, teams } = usePublic();
  const store = useStore();
  const toast = useToast();
  const t = teams.get(id);
  const [form, setForm] = useState({ full_name: "", number: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!ready) return <ListSkeleton />;
  if (!t) return <EmptyState title="Equipo no encontrado" />;
  const role = store.profile?.role;
  const canEdit = role === "admin" || role === "organizador" || (role === "delegado" && store.profile?.team_id === t.id);
  const players = data.players.filter((p) => p.team_id === t.id && p.active).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const usedNumbers = new Set(players.filter((p) => p.id !== editing?.id).map((p) => p.number));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = playerSchema.safeParse(form);
    if (!r.success) { setErrors(fieldErrors(r.error)); return; }
    if (r.data.number != null && usedNumbers.has(r.data.number)) { setErrors({ number: `El ${r.data.number} ya lo usa otro jugador` }); return; }
    setErrors({}); setBusy(true);
    try {
      if (editing) {
        toast.saved(await store.update("players", { id: editing.id }, r.data, "Jugador"), "Jugador actualizado");
        setEditing(null);
      } else {
        toast.saved(await store.insert("players", [{ team_id: t.id, ...r.data }], "Jugador"), r.data.full_name);
      }
      setForm({ full_name: "", number: "" });
      nameRef.current?.focus(); // permite registrar varios seguidos
    } catch (err) { toast.error(err, "No se guardó"); } finally { setBusy(false); }
  };

  const retire = async (p: Player) => {
    try {
      // Se desactiva (no se borra) para conservar goles y tarjetas históricos
      await store.update("players", { id: p.id }, { active: false }, "Jugador");
      toast.show({ tone: "info", title: `${p.full_name} retirado de la plantilla`, action: { label: "Deshacer", run: () => void store.update("players", { id: p.id }, { active: true }, "Jugador") } });
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin/equipos" className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Equipos</Link>
      <div className="flex items-center gap-3">
        <Crest team={t} size={56} />
        <PageHeader title={t.name} subtitle={`${players.length} jugadores`} />
        {(role === "admin" || role === "organizador") && <Link href={`/admin/equipos?editar=${t.id}`} className="btn btn-outline ml-auto px-3"><Pencil className="size-4" />Editar</Link>}
      </div>

      {canEdit && (
        <Card>
          <form onSubmit={submit} noValidate className="grid grid-cols-[1fr_5.5rem] gap-3">
            <Field label={editing ? "Editar jugador" : "Agregar jugador"} error={errors.full_name}>
              {(p) => <input {...p} ref={nameRef} className="input" placeholder="Nombre y apellido" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off" />}
            </Field>
            <Field label="N.°" error={errors.number}>
              {(p) => <input {...p} className="input" inputMode="numeric" placeholder="10" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, "").slice(0, 2) })} />}
            </Field>
            <div className="col-span-2 flex gap-2">
              {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setForm({ full_name: "", number: "" }); }}>Cancelar</button>}
              <SubmitButton busy={busy} type="submit" className="btn-primary flex-1">{editing ? "Guardar" : <><Plus className="size-4" />Agregar</>}</SubmitButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-[var(--muted)]">Al inscribir, el jugador autoriza que se publiquen su nombre y número. No registres documentos ni teléfonos.</p>
        </Card>
      )}

      <Section title="Plantilla">
        {players.length === 0 ? <EmptyState title="Sin jugadores" text={canEdit ? "Agrega el primero con el formulario de arriba." : undefined} /> : (
          <ul className="card divide-y divide-[var(--border)]">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-2.5 pl-3">
                <span className="grid size-8 place-items-center rounded-lg font-display text-sm font-bold" style={{ background: t.color_primary, color: t.color_secondary }}>{p.number ?? "–"}</span>
                <span className="flex-1 truncate">{p.full_name}</span>
                {canEdit && (
                  <>
                    <button className="btn btn-ghost px-2" aria-label={`Editar ${p.full_name}`} onClick={() => { setEditing(p); setForm({ full_name: p.full_name, number: p.number?.toString() ?? "" }); nameRef.current?.focus(); }}><Pencil className="size-4" /></button>
                    <ConfirmButton className="btn-ghost px-2" confirmText="Retirar" onConfirm={() => retire(p)}><UserMinus className="size-4" aria-label={`Retirar ${p.full_name}`} /></ConfirmButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><EquipoAdmin /></Suspense>;
}
