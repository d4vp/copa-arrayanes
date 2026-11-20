import type { Match, MatchEvent, Player } from "../types";
import { knockoutLoser, knockoutWinner } from "./fixtures";
import type { StandingRow } from "./standings";

export interface ScorerRow { playerId: string; teamId: string; goals: number }

/** Tabla de goleadores. Los autogoles no suman al jugador. */
export function topScorers(events: MatchEvent[], players: Player[], limit = 10): ScorerRow[] {
  const known = new Map(players.map((p) => [p.id, p]));
  const map = new Map<string, ScorerRow>();
  for (const e of events) {
    if (e.type !== "gol" || !e.player_id || !known.has(e.player_id)) continue;
    const row = map.get(e.player_id) ?? { playerId: e.player_id, teamId: known.get(e.player_id)!.team_id, goals: 0 };
    row.goals++;
    map.set(e.player_id, row);
  }
  return [...map.values()].sort((a, b) => b.goals - a.goals || a.playerId.localeCompare(b.playerId)).slice(0, limit);
}

export interface DefenseRow { teamId: string; played: number; against: number; average: number }

/**
 * Valla menos vencida: menor promedio de goles recibidos por partido.
 * Cuenta todos los partidos finalizados (incluida la fase final).
 * Exige un mínimo de partidos para no premiar a quien jugó uno solo.
 */
export function bestDefense(matches: Match[], minPlayed = 2): DefenseRow[] {
  const map = new Map<string, DefenseRow>();
  const add = (team: string | null, against: number) => {
    if (!team) return;
    const r = map.get(team) ?? { teamId: team, played: 0, against: 0, average: 0 };
    r.played++; r.against += against;
    map.set(team, r);
  };
  for (const m of matches) {
    if (m.status !== "finalizado" || m.home_score == null || m.away_score == null) continue;
    add(m.home_team_id, m.away_score);
    add(m.away_team_id, m.home_score);
  }
  return [...map.values()]
    .map((r) => ({ ...r, average: r.against / r.played }))
    .filter((r) => r.played >= minPlayed)
    .sort((a, b) => a.average - b.average || b.played - a.played);
}

/**
 * Podio 1°–4°.
 * Con fase final: final (1° y 2°) y tercer puesto (3° y 4°); si no se jugó
 * tercer puesto, 3° y 4° salen de los perdedores de semifinal según la tabla.
 * Sin fase final: los 4 primeros de la tabla.
 */
export function computePodium(matches: Match[], table: StandingRow[]): Array<string | null> {
  const final = matches.find((m) => m.stage === "final");
  if (!final) {
    const anyKnockout = matches.some((m) => !["liga", "grupo"].includes(m.stage));
    if (anyKnockout) return [null, null, null, null];
    const pending = matches.some((m) => m.status !== "finalizado" && m.status !== "cancelado");
    if (pending) return [null, null, null, null];
    return [0, 1, 2, 3].map((i) => table[i]?.teamId ?? null);
  }
  const first = knockoutWinner(final), second = knockoutLoser(final);
  const third = matches.find((m) => m.stage === "tercer_puesto");
  if (third) return [first, second, knockoutWinner(third), knockoutLoser(third)];
  const semiLosers = matches.filter((m) => m.stage === "semifinal").map(knockoutLoser).filter(Boolean) as string[];
  const rank = (id: string) => { const i = table.findIndex((r) => r.teamId === id); return i < 0 ? 999 : i; };
  semiLosers.sort((a, b) => rank(a) - rank(b));
  return [first, second, semiLosers[0] ?? null, semiLosers[1] ?? null];
}
