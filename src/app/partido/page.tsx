"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, MapPin, Pencil, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { EventIcon } from "@/components/event-icon";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, FavoriteButton, ListSkeleton } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { useStore } from "@/lib/data/store";
import { fmtDate, fmtTime, MATCH_STATUS_LABEL } from "@/lib/format";
import type { EventType } from "@/lib/types";

const EVENT_LABEL: Record<EventType, string> = { gol: "Gol", autogol: "Autogol", amarilla: "Tarjeta amarilla", roja: "Tarjeta roja" };

function Partido() {
  const id = useSearchParams().get("id");
  const { data, ready, teams } = usePublic();
  const { profile } = useStore();
  const toast = useToast();
  const m = data.matches.find((x) => x.id === id);
  if (!ready) return <ListSkeleton rows={3} />;
  if (!m) return <EmptyState title="Partido no encontrado" text="Puede que haya sido reprogramado o eliminado." action={<Link href="/partidos" className="btn btn-primary">Ver partidos</Link>} />;

  const cat = data.categories.find((c) => c.id === m.category_id);
  const home = m.home_team_id ? teams.get(m.home_team_id) : undefined;
  const away = m.away_team_id ? teams.get(m.away_team_id) : undefined;
  const events = data.match_events.filter((e) => e.match_id === m.id).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const players = new Map(data.players.map((p) => [p.id, p]));
  const played = m.status === "finalizado" || m.status === "en_juego";
  const canEdit = profile && ["admin", "organizador", "planillero"].includes(profile.role);

  const share = async () => {
    const text = played ? `${home?.name} ${m.home_score} - ${m.away_score} ${away?.name} · Copa Arrayanes` : `${home?.name} vs ${away?.name} · ${fmtDate(m.scheduled_at)} ${fmtTime(m.scheduled_at)} · Copa Arrayanes`;
    try {
      if (navigator.share) await navigator.share({ text, url: location.href });
      else { await navigator.clipboard.writeText(`${text} ${location.href}`); toast.show({ tone: "exito", title: "Enlace copiado" }); }
    } catch { /* cancelado */ }
  };

  const side = (teamId: string | null) => events.filter((e) => e.team_id === teamId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => history.length > 1 ? history.back() : (location.href = "/partidos")} className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Volver</button>
        <div className="flex gap-1">
          {canEdit && <Link href={`/admin/partido?id=${m.id}`} className="btn btn-outline px-3"><Pencil className="size-4" />Registrar</Link>}
          <button onClick={share} className="btn btn-ghost px-3" aria-label="Compartir"><Share2 className="size-4" /></button>
        </div>
      </div>

      <section className="card fade-up overflow-hidden">
        <div className="bg-[var(--surface-2)] px-4 py-2 text-center text-xs font-semibold text-[var(--muted)]">
          {cat?.name} · {m.stage === "grupo" ? `Grupo ${m.group_label} · Fecha ${m.round}` : m.stage === "liga" ? `Fecha ${m.round}` : STAGE_LABEL[m.stage]}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 px-3 py-6">
          {[home, away].map((t, i) => (
            <div key={i} className={`flex flex-col items-center gap-2 text-center ${i === 1 ? "order-3" : ""}`}>
              <Link href={t ? `/equipo?id=${t.id}` : "#"}><Crest team={t} size={64} /></Link>
              <span className="font-display text-lg font-bold leading-tight">{t?.name ?? "Por definir"}</span>
              {t && <FavoriteButton kind="teams" id={t.id} label={t.name} size="sm" />}
            </div>
          ))}
          <div className="order-2 pt-3 text-center">
            {played ? (
              <p className="font-display tabular text-5xl font-extrabold">{m.home_score ?? 0}<span className="mx-2 text-[var(--muted)]">-</span>{m.away_score ?? 0}</p>
            ) : <p className="font-display text-2xl font-bold text-[var(--muted)]">vs</p>}
            {m.home_penalties != null && <p className="text-xs text-[var(--muted)]">Penales {m.home_penalties} - {m.away_penalties}</p>}
            <div className="mt-2">
              {m.status === "en_juego" ? <Badge tone="live"><span className="live-dot size-1.5 rounded-full bg-current" />En juego</Badge>
                : <Badge tone={m.status === "finalizado" ? "neutral" : m.status === "programado" ? "brand" : "warning"}>{MATCH_STATUS_LABEL[m.status]}</Badge>}
            </div>
          </div>
        </div>
        {events.length > 0 && (
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] px-4 py-3 text-sm">
            {[m.home_team_id, m.away_team_id].map((tid, i) => (
              <ul key={i} className={`space-y-1 ${i === 1 ? "text-right" : ""}`}>
                {side(tid).map((e) => (
                  <li key={e.id} title={EVENT_LABEL[e.type]}>
                    <EventIcon type={e.type} className="mr-1 inline-block align-[-2px]" />
                    {e.player_id ? players.get(e.player_id)?.full_name ?? "Jugador" : EVENT_LABEL[e.type]}
                    {e.type === "autogol" && " (a.g.)"}{e.minute != null && <span className="text-[var(--muted)]"> {e.minute}&apos;</span>}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </section>

      <section className="card divide-y divide-[var(--border)] text-sm">
        <p className="flex items-center gap-3 p-3"><CalendarDays className="size-4 text-[var(--muted)]" aria-hidden />{fmtDate(m.scheduled_at, { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="flex items-center gap-3 p-3"><Clock className="size-4 text-[var(--muted)]" aria-hidden />{fmtTime(m.scheduled_at)}</p>
        {m.venue && <p className="flex items-center gap-3 p-3"><MapPin className="size-4 text-[var(--muted)]" aria-hidden />{m.venue}</p>}
        {m.notes && <p className="p-3 text-[var(--muted)]">{m.notes}</p>}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton rows={3} />}><Partido /></Suspense>;
}
