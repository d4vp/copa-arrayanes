"use client";

import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { Card, ConfirmButton, Field, SubmitButton } from "@/components/form";
import { NoticeBanner } from "@/components/notices";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, PageHeader, Section } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { fmtDate, localInputToIso } from "@/lib/format";
import type { NoticeKind } from "@/lib/types";
import { fieldErrors, noticeSchema } from "@/lib/validation";

const KINDS: Array<{ v: NoticeKind; l: string; d: string }> = [
  { v: "comunidad", l: "Comunidad", d: "Mingas, reuniones, avisos generales" },
  { v: "ventas", l: "Ventas", d: "Comidas y productos durante los partidos" },
  { v: "partido", l: "Partido", d: "Cambios de horario, cancha, sanciones" },
];

/** Avisos parroquiales: cortos, con fecha de vencimiento. */
export default function AvisosPage() {
  const { data } = usePublic();
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", kind: "comunidad" as NoticeKind, ends_at: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const now = new Date().toISOString();
  const list = [...data.notices].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const save = async () => {
    const r = noticeSchema.safeParse(f);
    if (!r.success) { setErrors(fieldErrors(r.error)); return; }
    setErrors({}); setBusy(true);
    try {
      toast.saved(await store.insert("notices", [{ ...r.data, ends_at: r.data.ends_at ? localInputToIso(r.data.ends_at) : null, starts_at: now, active: true }], "Aviso"), "Aviso publicado");
      setF({ title: "", body: "", kind: "comunidad", ends_at: "" }); setOpen(false);
    } catch (e) { toast.error(e, "No se publicó"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Avisos" subtitle="Aparecen en un banner pequeño en el inicio." action={!open && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" />Nuevo</button>} />
      {open && (
        <Card className="fade-up space-y-4">
          <fieldset><legend className="mb-2 text-sm font-semibold">Tipo</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {KINDS.map((k) => (
                <label key={k.v} className={`cursor-pointer rounded-xl border p-3 ${f.kind === k.v ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
                  <input type="radio" name="kind" className="sr-only" checked={f.kind === k.v} onChange={() => setF({ ...f, kind: k.v })} />
                  <span className="block text-sm font-semibold">{k.l}</span><span className="block text-xs text-[var(--muted)]">{k.d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Título" error={errors.title} hint={`${f.title.length}/80`}>{(p) => <input {...p} className="input" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Venta de empanadas" />}</Field>
          <Field label="Detalle" optional error={errors.body} hint={`${f.body.length}/280`}>{(p) => <textarea {...p} className="input min-h-20" maxLength={280} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
          <Field label="Mostrar hasta" optional hint="Después se oculta solo.">{(p) => <input {...p} type="datetime-local" className="input" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />}</Field>
          {f.title.length >= 3 && <div><p className="mb-1 text-xs font-semibold text-[var(--muted)]">Vista previa</p><NoticeBanner notices={[{ id: "prev", title: f.title, body: f.body || null, kind: f.kind, starts_at: "2000-01-01", ends_at: null, active: true, created_at: "" }]} /></div>}
          <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><SubmitButton busy={busy} className="btn-primary flex-1" onClick={save}>Publicar</SubmitButton></div>
        </Card>
      )}
      <Section title="Publicados">
        {list.length === 0 ? <EmptyState icon={<Megaphone className="size-8" />} title="Sin avisos" /> : (
          <ul className="card divide-y divide-[var(--border)]">
            {list.map((n) => {
              const live = n.active && n.starts_at <= now && (!n.ends_at || n.ends_at > now);
              return (
                <li key={n.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{n.title}</p>
                    <p className="text-xs text-[var(--muted)]">{KINDS.find((k) => k.v === n.kind)?.l} · {n.ends_at ? `hasta ${fmtDate(n.ends_at)}` : "sin vencimiento"}</p>
                  </div>
                  <Badge tone={live ? "accent" : "neutral"}>{live ? "Visible" : "Oculto"}</Badge>
                  <button className="btn btn-ghost px-2 text-sm" onClick={() => store.update("notices", { id: n.id }, { active: !n.active }, "Aviso").catch((e) => toast.error(e))}>{n.active ? "Ocultar" : "Mostrar"}</button>
                  <ConfirmButton className="btn-ghost px-2 text-sm" confirmText="Borrar" onConfirm={() => store.remove("notices", { id: n.id }, "Aviso").then(() => undefined).catch((e) => toast.error(e))}>Eliminar</ConfirmButton>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
