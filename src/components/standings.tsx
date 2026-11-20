"use client";

import Link from "next/link";
import type { StandingRow } from "@/lib/domain/standings";
import { TIEBREAKER_LABEL } from "@/lib/domain/standings";
import type { Match, Team, Tiebreaker } from "@/lib/types";
import { knockoutWinner } from "@/lib/domain/fixtures";
import { STAGE_LABEL } from "@/lib/domain/formats";
import { Crest } from "./crest";

const FORM_COLOR = { G: "bg-emerald-500", E: "bg-slate-400", P: "bg-red-500" };

export function StandingsTable({ rows, teams, qualify = 0, favorites = [], tiebreakers }: {
  rows: StandingRow[]; teams: Map<string, Team>; qualify?: number; favorites?: string[]; tiebreakers?: Tiebreaker[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[22rem] text-sm">
          <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="w-8 py-2 pl-3 text-left font-semibold" scope="col">#</th>
              <th className="py-2 text-left font-semibold" scope="col">Equipo</th>
              <th className="px-1.5 py-2 font-semibold" scope="col" title="Partidos jugados">PJ</th>
              <th className="hidden px-1.5 py-2 font-semibold sm:table-cell" scope="col" title="Ganados">G</th>
              <th className="hidden px-1.5 py-2 font-semibold sm:table-cell" scope="col" title="Empatados">E</th>
              <th className="hidden px-1.5 py-2 font-semibold sm:table-cell" scope="col" title="Perdidos">P</th>
              <th className="px-1.5 py-2 font-semibold" scope="col" title="Diferencia de goles">DG</th>
              <th className="hidden px-1.5 py-2 font-semibold md:table-cell" scope="col" title="Juego limpio: amarilla 1, roja 3">JL</th>
              <th className="px-3 py-2 font-semibold" scope="col">Pts</th>
              <th className="hidden px-3 py-2 text-left font-semibold lg:table-cell" scope="col">Últimos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const t = teams.get(r.teamId);
              const fav = favorites.includes(r.teamId);
              return (
                <tr key={r.teamId} className={`border-t border-[var(--border)] ${fav ? "bg-amber-400/10" : ""}`}>
                  <td className="py-2 pl-3">
                    <span className={`grid size-6 place-items-center rounded-md text-xs font-bold ${i < qualify ? "bg-[var(--accent)] text-white dark:text-[#0b1220]" : "text-[var(--muted)]"}`}>{i + 1}</span>
                  </td>
                  <td className="py-2">
                    <Link href={`/equipo?id=${r.teamId}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <Crest team={t} size={24} />
                      <span className="truncate font-medium">{t?.name ?? "—"}</span>
                    </Link>
                  </td>
                  <td className="px-1.5 text-center">{r.played}</td>
                  <td className="hidden px-1.5 text-center sm:table-cell">{r.won}</td>
                  <td className="hidden px-1.5 text-center sm:table-cell">{r.drawn}</td>
                  <td className="hidden px-1.5 text-center sm:table-cell">{r.lost}</td>
                  <td className="px-1.5 text-center">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                  <td className="hidden px-1.5 text-center md:table-cell">{r.fairPlay}</td>
                  <td className="px-3 text-center font-display text-base font-extrabold">{r.points}</td>
                  <td className="hidden px-3 lg:table-cell">
                    <span className="flex gap-1" aria-label={`Últimos: ${r.form.join(", ")}`}>
                      {r.form.map((f, k) => <span key={k} className={`size-2.5 rounded-full ${FORM_COLOR[f]}`} title={{ G: "Ganó", E: "Empató", P: "Perdió" }[f]} />)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(qualify > 0 || tiebreakers) && (
        <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          {qualify > 0 && <><span className="mr-1 inline-block size-2.5 rounded-sm bg-[var(--accent)] align-middle" />Clasifica a la fase final. </>}
          {tiebreakers && <>Desempate: {tiebreakers.map((t) => TIEBREAKER_LABEL[t]).join(" › ")}.</>}
        </p>
      )}
    </div>
  );
}

const ROUND_ORDER = ["octavos", "cuartos", "semifinal", "final"] as const;

/** Llave de eliminación directa en columnas, desplazable en celulares. */
export function Bracket({ matches, teams }: { matches: Match[]; teams: Map<string, Team> }) {
  const rounds = ROUND_ORDER.map((s) => ({ stage: s, list: matches.filter((m) => m.stage === s).sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0)) }))
    .filter((r) => r.list.length);
  const third = matches.find((m) => m.stage === "tercer_puesto");
  if (!rounds.length) return null;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {rounds.map((r) => (
          <div key={r.stage} className="flex w-56 flex-col justify-around gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{STAGE_LABEL[r.stage]}</p>
            {r.list.map((m) => <BracketMatch key={m.id} m={m} teams={teams} />)}
          </div>
        ))}
        {third && (
          <div className="flex w-56 flex-col justify-end gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{STAGE_LABEL.tercer_puesto}</p>
            <BracketMatch m={third} teams={teams} />
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatch({ m, teams }: { m: Match; teams: Map<string, Team> }) {
  const w = knockoutWinner(m);
  const row = (id: string | null, score: number | null, pens: number | null) => {
    const t = id ? teams.get(id) : undefined;
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${w && w === id ? "font-bold" : w ? "text-[var(--muted)]" : ""}`}>
        <Crest team={t} size={20} />
        <span className="flex-1 truncate text-sm">{t?.name ?? "Por definir"}</span>
        <span className="tabular text-sm">{score ?? ""}{pens != null ? <sup className="ml-0.5 text-[0.65rem]">({pens})</sup> : null}</span>
      </div>
    );
  };
  return (
    <Link href={`/partido?id=${m.id}`} className="card block divide-y divide-[var(--border)] overflow-hidden hover:shadow-md">
      {row(m.home_team_id, m.home_score, m.home_penalties)}
      {row(m.away_team_id, m.away_score, m.away_penalties)}
    </Link>
  );
}
