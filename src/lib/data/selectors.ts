import { computeStandings, type StandingRow } from "../domain/standings";
import { bestDefense, computePodium, topScorers } from "../domain/stats";
import type { Category, Edition, Match, Team } from "../types";
import type { Snapshot } from "./backend";

/**
 * Edición que ve el público: la que se juega; si no, la que está en inscripciones;
 * si no, la última finalizada (con su campeón). Una edición en planificación solo
 * se muestra si no hay ninguna otra.
 */
export function currentEdition(d: Snapshot): Edition | null {
  const byYear = [...d.editions].sort((a, b) => b.year - a.year);
  for (const status of ["en_desarrollo", "inscripcion", "finalizado", "planificacion"] as const) {
    const e = byYear.find((x) => x.status === status);
    if (e) return e;
  }
  return null;
}

export function teamMap(d: Snapshot): Map<string, Team> {
  return new Map(d.teams.map((t) => [t.id, t]));
}

export function categoriesOf(d: Snapshot, editionId: string | undefined): Category[] {
  return d.categories.filter((c) => c.edition_id === editionId).sort((a, b) => a.name.localeCompare(b.name));
}

export interface CategoryView {
  category: Category;
  teamIds: string[];
  groups: Array<{ label: string | null; rows: StandingRow[] }>;
  table: StandingRow[];
  matches: Match[];
  knockout: Match[];
  podium: Array<string | null>;
  scorers: ReturnType<typeof topScorers>;
  defense: ReturnType<typeof bestDefense>;
}

export function categoryView(d: Snapshot, category: Category): CategoryView {
  const ct = d.category_teams.filter((x) => x.category_id === category.id);
  const teamIds = ct.map((x) => x.team_id);
  const matches = d.matches.filter((m) => m.category_id === category.id);
  const matchIds = new Set(matches.map((m) => m.id));
  const events = d.match_events.filter((e) => matchIds.has(e.match_id));

  const labels = [...new Set(ct.map((x) => x.group_label))].sort((a, b) => (a ?? "").localeCompare(b ?? ""));
  const multi = labels.length > 1 || (labels.length === 1 && labels[0] !== null && category.group_count > 1);
  const groups = multi
    ? labels.map((label) => ({ label, rows: computeStandings(ct.filter((x) => x.group_label === label).map((x) => x.team_id), matches, events, category) }))
    : [{ label: null, rows: computeStandings(teamIds, matches, events, category) }];
  const table = computeStandings(teamIds, matches, events, category);

  // Podio guardado (histórico) tiene prioridad sobre el calculado
  const stored = d.category_podium.filter((p) => p.category_id === category.id);
  const podium = stored.length
    ? [1, 2, 3, 4].map((pos) => stored.find((p) => p.position === pos)?.team_id ?? null)
    : computePodium(matches, table);

  const teamPlayers = d.players.filter((p) => teamIds.includes(p.team_id));
  return {
    category, teamIds, groups, table, matches,
    knockout: matches.filter((m) => !["liga", "grupo"].includes(m.stage)),
    podium,
    scorers: topScorers(events, teamPlayers),
    defense: bestDefense(matches),
  };
}

export function byDate(a: Match, b: Match) {
  return (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999");
}

/** Partido relevante para los favoritos del visitante */
export function involvesFavorites(m: Match, teams: Map<string, Team>, favTeams: string[], favVeredas: string[]) {
  return [m.home_team_id, m.away_team_id].some((id) => {
    if (!id) return false;
    if (favTeams.includes(id)) return true;
    const v = teams.get(id)?.vereda_id;
    return Boolean(v && favVeredas.includes(v));
  });
}
