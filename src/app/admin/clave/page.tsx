"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand";
import { Field, SubmitButton } from "@/components/form";
import { useToast } from "@/components/toast";
import { getBackend } from "@/lib/data/store";
import { SupabaseBackend } from "@/lib/data/supabase-backend";
import { toAppError } from "@/lib/errors";

/** Recuperar contraseña (paso 1: pedir correo) o fijar una nueva (paso 2: desde el enlace del correo). */
export default function ClavePage() {
  const toast = useToast();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setRecovery(/type=recovery|access_token/.test(window.location.hash)); }, []);

  const request = async () => {
    setErr(null); setBusy(true);
    try { await getBackend().sendPasswordReset(email.trim()); setMsg("Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam."); }
    catch (e) { setErr(toAppError(e).message); } finally { setBusy(false); }
  };

  const change = async () => {
    setErr(null);
    if (pw.a.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (pw.a !== pw.b) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const b = getBackend();
      if (b instanceof SupabaseBackend) await b.updatePassword(pw.a);
      toast.show({ tone: "exito", title: "Contraseña actualizada" });
      window.location.href = "/admin";
    } catch (e) { setErr(toAppError(e).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <div className="flex flex-col items-center text-center"><LogoMark className="size-14" /><h1 className="font-display mt-3 text-2xl font-extrabold">{recovery ? "Nueva contraseña" : "Recuperar contraseña"}</h1></div>
      <div className="card space-y-4 p-5">
        {err && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-[var(--danger)]">{err}</p>}
        {msg ? <p role="status" className="rounded-lg bg-[var(--accent-soft)] p-3 text-sm">{msg}</p> : recovery ? (
          <>
            <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">{(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />}</Field>
            <Field label="Repite la contraseña">{(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />}</Field>
            <SubmitButton busy={busy} className="btn-primary w-full" onClick={change}>Guardar contraseña</SubmitButton>
          </>
        ) : (
          <>
            <Field label="Correo">{(p) => <input {...p} type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <SubmitButton busy={busy} className="btn-primary w-full" onClick={request} disabled={!email.includes("@")}>Enviar enlace</SubmitButton>
          </>
        )}
        <Link href="/admin" className="block text-center text-sm text-[var(--brand)]">Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}
