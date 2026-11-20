"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { fmtTime, MATCH_STATUS_LABEL, relativeDay } from "@/lib/format";
import type { Category, Match, Team } from "@/lib/types";
import { Crest } from "./crest";
import { Badge } from "./ui";

function stageText(m: Match) {
  if (m.stage === "grupo") return `Grupo ${m.group_label} · Fecha ${m.round}`;
  if (m.stage === "liga") return `Fecha ${m.round}`;
  return STAGE_LABEL[m.stage];
}

export function MatchCard({ match: m, teams, category, highlight = false, href }: {
  match: Match; teams: Map<string, Team>; category?: Category; highlight?: boolean; href?: string;
}) {
  const home = m.home_team_id ? teams.get(m.home_team_id) : undefined;
  const away = m.away_team_id ? teams.get(m.away_team_id) : undefined;
  const done = m.status === "finalizado";
  const live = m.status === "en_juego";
  const homeWin = done && (m.home_score! > m.away_score! || (m.home_score === m.away_score && (m.home_penalties ?? 0) > (m.away_penalties ?? 0)));
  const awayWin = done && !homeWin && m.home_score !== null && (m.away_score! > m.home_score! || (m.away_penalties ?? 0) > (m.home_penalties ?? 0));
  const hasPens = m.home_penalties != null && m.away_penalties != null;

  return (
    <Link href={href ?? `/partido?id=${m.id}`}
      className={`card block p-3 transition-shadow hover:shadow-md ${highlight ? "ring-2 ring-amber-400/60" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span className="truncate">{category ? `${category.name} · ` : ""}{stageText(m)}</span>
        {live ? <Badge tone="live"><span className="live-dot size-1.5 rounded-full bg-current" />En juego</Badge>
          : m.status === "aplazado" || m.status === "cancelado" ? <Badge tone="warning">{MATCH_STATUS_LABEL[m.status]}</Badge>
          : done ? <Badge>Final</Badge>
          : <span className="font-medium">{relativeDay(m.scheduled_at)} · {fmtTime(m.scheduled_at)}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamSide team={home} bold={homeWin} />
        <div className="tabular min-w-16 text-center">
          {done || live ? (
            <span className="font-display text-2xl font-extrabold">{m.home_score ?? 0}<span className="mx-1 text-[var(--muted)]">-</span>{m.away_score ?? 0}</span>
          ) : <span className="text-sm font-semibold text-[var(--muted)]">vs</span>}
          {hasPens && <span className="block text-[0.7rem] text-[var(--muted)]">Penales {m.home_penalties}-{m.away_penalties}</span>}
        </div>
        <TeamSide team={away} bold={awayWin} right />
      </div>
      {m.venue && !done && (
        <p className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]"><MapPin className="size-3.5" aria-hidden />{m.venue}</p>
      )}
    </Link>
  );
}

function TeamSide({ team, bold, right = false }: { team?: Team; bold: boolean; right?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Crest team={team} size={34} />
      <span className={`truncate text-sm ${bold ? "font-bold" : "font-medium"}`}>{team?.name ?? "Por definir"}</span>
    </div>
  );
}
