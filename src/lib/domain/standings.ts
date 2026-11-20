import type { Category, Match, MatchEvent, Tiebreaker } from "../types";

export interface StandingRow {
  teamId: string;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number;
  points: number;
  /** Puntos de juego limpio: amarilla = 1, roja = 3. Menos es mejor. */
  fairPlay: number;
  /** Últimos 5 resultados, del más antiguo al más reciente. */
  form: Array<"G" | "E" | "P">;
}

type Rules = Pick<Category, "points_win" | "points_draw" | "points_loss" | "tiebreakers">;

export const FAIR_PLAY_WEIGHT = { amarilla: 1, roja: 3 } as const;

/**
 * Tabla de posiciones de una liga o grupo.
 * Solo cuentan partidos finalizados de fase "liga" o "grupo".
 */
export function computeStandings(
  teamIds: string[],
  matches: Match[],
  events: MatchEvent[],
  rules: Rules,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of teamIds) {
    rows.set(id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, fairPlay: 0, form: [] });
  }

  const counted = matches
    .filter((m) => m.status === "finalizado" && (m.stage === "liga" || m.stage === "grupo"))
    .filter((m) => m.home_team_id && m.away_team_id && rows.has(m.home_team_id) && rows.has(m.away_team_id))
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  const countedIds = new Set(counted.map((m) => m.id));

  for (const m of counted) {
    const h = rows.get(m.home_team_id!)!;
    const a = rows.get(m.away_team_id!)!;
    const hs = m.home_score ?? 0, as = m.away_score ?? 0;
    h.played++; a.played++;
    h.goalsFor += hs; h.goalsAgainst += as;
    a.goalsFor += as; a.goalsAgainst += hs;
    if (hs > as) { h.won++; a.lost++; h.points += rules.points_win; a.points += rules.points_loss; h.form.push("G"); a.form.push("P"); }
    else if (hs < as) { a.won++; h.lost++; a.points += rules.points_win; h.points += rules.points_loss; a.form.push("G"); h.form.push("P"); }
    else { h.drawn++; a.drawn++; h.points += rules.points_draw; a.points += rules.points_draw; h.form.push("E"); a.form.push("E"); }
  }

  for (const e of events) {
    if (!countedIds.has(e.match_id)) continue;
    const r = rows.get(e.team_id);
    if (r && (e.type === "amarilla" || e.type === "roja")) r.fairPlay += FAIR_PLAY_WEIGHT[e.type];
  }

  const list = [...rows.values()];
  for (const r of list) { r.goalDiff = r.goalsFor - r.goalsAgainst; r.form = r.form.slice(-5); }
  return sortStandings(list, rules.tiebreakers);
}

const comparators: Record<Tiebreaker, (a: StandingRow, b: StandingRow) => number> = {
  puntos: (a, b) => b.points - a.points,
  diferencia: (a, b) => b.goalDiff - a.goalDiff,
  juego_limpio: (a, b) => a.fairPlay - b.fairPlay,
  goles_favor: (a, b) => b.goalsFor - a.goalsFor,
};

export function sortStandings(rows: StandingRow[], tiebreakers: Tiebreaker[]): StandingRow[] {
  const order: Tiebreaker[] = tiebreakers.includes("puntos") ? tiebreakers : ["puntos", ...tiebreakers];
  return [...rows].sort((a, b) => {
    for (const t of order) {
      const d = comparators[t](a, b);
      if (d !== 0) return d;
    }
    return a.teamId.localeCompare(b.teamId); // determinista
  });
}

export const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  puntos: "Puntos",
  diferencia: "Diferencia de goles",
  juego_limpio: "Juego limpio (menos tarjetas)",
  goles_favor: "Goles a favor",
};
