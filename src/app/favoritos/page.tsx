"use client";

import Link from "next/link";
import { Bell, BellOff, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Crest } from "@/components/crest";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, FavoriteButton, PageHeader, Section } from "@/components/ui";
import { useFavorites } from "@/lib/favorites";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";

const STATE_TEXT: Record<PushState, string> = {
  activo: "Recibirás avisos de partidos y resultados.",
  inactivo: "Activa los avisos para enterarte sin abrir la app.",
  bloqueado: "Bloqueaste las notificaciones. Para activarlas, entra a los ajustes del navegador → Notificaciones → permitir este sitio.",
  no_soportado: "Este navegador no admite notificaciones. En iPhone, primero agrega la app a la pantalla de inicio (iOS 16.4 o posterior).",
  sin_configurar: "Las notificaciones aún no están habilitadas por el comité.",
};

export default function FavoritosPage() {
  const { data, teams } = usePublic();
  const { fav } = useFavorites();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
    try { setAll(localStorage.getItem("copa-push-todo") === "1"); } catch { /* */ }
  }, []);

  const on = state === "activo";
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) { await disablePush(); toast.show({ tone: "info", title: "Avisos desactivados" }); }
      else { await enablePush(all); toast.show({ tone: "exito", title: "Avisos activados", detail: all ? "Te avisaremos de todos los partidos." : "Te avisaremos de tus favoritos." }); }
    } catch (e) { toast.error(e, "No se pudieron cambiar los avisos"); }
    finally { setState(await pushState()); setBusy(false); }
  };

  const favTeams = fav.teams.map((id) => teams.get(id)).filter(Boolean);
  const favVeredas = fav.veredas.map((id) => data.veredas.find((v) => v.id === id)).filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Favoritos y avisos" subtitle="Se guardan en este teléfono. No necesitas crear cuenta." />

      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${on ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
            {on ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Notificaciones</h2>
            <p className="text-sm text-[var(--muted)]">{state ? STATE_TEXT[state] : "Revisando…"}</p>
          </div>
        </div>
        {(state === "activo" || state === "inactivo") && (
          <>
            <fieldset className="mt-4 space-y-2" disabled={on}>
              <legend className="sr-only">¿De qué partidos quieres avisos?</legend>
              {[[false, "Solo mis favoritos", "Recordatorio 1 hora antes y resultado final."], [true, "Todos los partidos", "Útil para organizadores y aficionados."]].map(([v, l, d]) => (
                <label key={String(v)} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${all === v ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)]"} ${on ? "opacity-60" : ""}`}>
                  <input type="radio" name="alcance" className="mt-1 accent-[var(--brand)]" checked={all === v} onChange={() => setAll(v as boolean)} />
                  <span><span className="block text-sm font-semibold">{l as string}</span><span className="block text-xs text-[var(--muted)]">{d as string}</span></span>
                </label>
              ))}
            </fieldset>
            <button className={`btn mt-4 w-full ${on ? "btn-outline" : "btn-primary"}`} onClick={toggle} disabled={busy}>
              {busy ? "Un momento…" : on ? "Desactivar avisos" : "Activar avisos"}
            </button>
            {!on && !all && favTeams.length + favVeredas.length === 0 && (
              <p className="mt-2 text-xs text-[var(--warning)]">Aún no tienes favoritos: marca al menos un equipo o vereda para recibir sus avisos.</p>
            )}
          </>
        )}
      </section>

      <Section title="Mis equipos">
        {favTeams.length === 0 ? (
          <EmptyState icon={<Star className="size-8" />} title="Sin equipos favoritos" text="Toca la estrella junto a un equipo para seguirlo." action={<Link href="/equipos" className="btn btn-primary">Elegir equipos</Link>} />
        ) : (
          <ul className="card divide-y divide-[var(--border)]">
            {favTeams.map((t) => (
              <li key={t!.id} className="flex items-center gap-3 p-2 pl-3">
                <Link href={`/equipo?id=${t!.id}`} className="flex flex-1 items-center gap-3"><Crest team={t} size={32} /><span className="font-semibold">{t!.name}</span></Link>
                <FavoriteButton kind="teams" id={t!.id} label={t!.name} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {favVeredas.length > 0 && (
        <Section title="Mis veredas">
          <ul className="card divide-y divide-[var(--border)]">
            {favVeredas.map((v) => (
              <li key={v!.id} className="flex items-center gap-3 p-2 pl-3">
                <span className="flex-1 font-semibold">Vereda {v!.name}</span>
                <FavoriteButton kind="veredas" id={v!.id} label={`vereda ${v!.name}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
