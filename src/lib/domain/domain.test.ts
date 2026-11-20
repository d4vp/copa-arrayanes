import { describe, expect, it } from "vitest";
import type { Category, Match, MatchEvent, Player } from "../types";
import { generateGroupStage, knockoutWinner, nextKnockoutRound, roundRobin, seedKnockout, splitIntoGroups } from "./fixtures";
import { computeStandings } from "./standings";
import { bestDefense, computePodium, topScorers } from "./stats";

const rules: Pick<Category, "points_win" | "points_draw" | "points_loss" | "tiebreakers"> = {
  points_win: 3, points_draw: 1, points_loss: 0, tiebreakers: ["puntos", "diferencia", "juego_limpio", "goles_favor"],
};

let seq = 0;
function m(home: string, away: string, hs: number | null, as: number | null, extra: Partial<Match> = {}): Match {
  return {
    id: `m${++seq}`, category_id: "c", stage: "liga", group_label: null, round: 1, bracket_slot: null,
    home_team_id: home, away_team_id: away, scheduled_at: `2026-01-${String(seq).padStart(2, "0")}T15:00:00Z`, venue: null,
    status: hs == null ? "programado" : "finalizado", home_score: hs, away_score: as,
    home_penalties: null, away_penalties: null, notes: null, updated_at: "", ...extra,
  };
}
const ev = (match_id: string, team_id: string, type: MatchEvent["type"], player_id: string | null = null): MatchEvent =>
  ({ id: `e${++seq}`, match_id, team_id, player_id, type, minute: null, created_at: "" });

describe("roundRobin", () => {
  it("cada equipo juega una vez contra todos (par)", () => {
    const rounds = roundRobin(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3);
    const pairs = rounds.flat().map((p) => [...p].sort().join());
    expect(new Set(pairs).size).toBe(6);
  });
  it("impar: un equipo descansa por fecha", () => {
    const rounds = roundRobin(["A", "B", "C", "D", "E"]);
    expect(rounds).toHaveLength(5);
    expect(rounds.every((r) => r.length === 2)).toBe(true);
    expect(new Set(rounds.flat().map((p) => [...p].sort().join())).size).toBe(10);
  });
  it("ningún equipo juega dos veces la misma fecha", () => {
    for (const r of roundRobin(["A", "B", "C", "D", "E", "F"])) {
      const teams = r.flat();
      expect(new Set(teams).size).toBe(teams.length);
    }
  });
});

describe("grupos y llaves", () => {
  it("reparte en zigzag", () => {
    expect(splitIntoGroups(["1", "2", "3", "4", "5", "6"], 2)).toEqual({ A: ["1", "4", "5"], B: ["2", "3", "6"] });
  });
  it("genera partidos de grupo etiquetados", () => {
    const ms = generateGroupStage("c", { A: ["1", "2", "3"], B: ["4", "5", "6"] });
    expect(ms).toHaveLength(6);
    expect(ms.every((x) => x.stage === "grupo")).toBe(true);
  });
  it("cruza 1A-2B y 1B-2A", () => {
    expect(seedKnockout({ A: ["a1", "a2"], B: ["b1", "b2"] }, 4)).toEqual([["a1", "b2"], ["b1", "a2"]]);
  });
  it("una sola tabla: 1 vs 4, 2 vs 3", () => {
    expect(seedKnockout({ A: ["1", "2", "3", "4", "5"] }, 4)).toEqual([["1", "4"], ["2", "3"]]);
  });
  it("define ganador por penales", () => {
    expect(knockoutWinner(m("X", "Y", 1, 1, { home_penalties: 3, away_penalties: 4 }))).toBe("Y");
    expect(knockoutWinner(m("X", "Y", 1, 1))).toBeNull();
  });
  it("tras semifinales genera final y tercer puesto", () => {
    const semis = [m("A", "D", 2, 0, { stage: "semifinal", bracket_slot: 1 }), m("B", "C", 0, 1, { stage: "semifinal", bracket_slot: 2 })];
    const next = nextKnockoutRound("c", semis, true);
    expect(next.find((x) => x.stage === "final")).toMatchObject({ home_team_id: "A", away_team_id: "C" });
    expect(next.find((x) => x.stage === "tercer_puesto")).toMatchObject({ home_team_id: "D", away_team_id: "B" });
  });
  it("no genera la siguiente ronda si falta un resultado", () => {
    expect(nextKnockoutRound("c", [m("A", "D", 2, 0, { stage: "semifinal" }), m("B", "C", null, null, { stage: "semifinal" })], true)).toEqual([]);
  });
});

describe("tabla de posiciones", () => {
  it("3-1-0 y diferencia de goles", () => {
    const ms = [m("A", "B", 2, 0), m("B", "C", 1, 1), m("A", "C", 0, 1)];
    const t = computeStandings(["A", "B", "C"], ms, [], rules);
    expect(t.map((r) => [r.teamId, r.points, r.goalDiff])).toEqual([["C", 4, 1], ["A", 3, 1], ["B", 1, -2]]);
  });
  it("desempata por juego limpio", () => {
    const m1 = m("A", "B", 1, 0), m2 = m("B", "A", 1, 0);
    const t = computeStandings(["A", "B"], [m1, m2], [ev(m1.id, "A", "roja"), ev(m2.id, "B", "amarilla")], rules);
    expect(t[0].teamId).toBe("B");
    expect(t.map((r) => r.fairPlay)).toEqual([1, 3]);
  });
  it("ignora partidos no finalizados y de fase final", () => {
    const t = computeStandings(["A", "B"], [m("A", "B", null, null), m("A", "B", 3, 0, { stage: "final" })], [], rules);
    expect(t.every((r) => r.played === 0)).toBe(true);
  });
});

describe("estadísticas", () => {
  const players: Player[] = [
    { id: "p1", team_id: "A", full_name: "Uno", number: 9, active: true, created_at: "" },
    { id: "p2", team_id: "B", full_name: "Dos", number: 10, active: true, created_at: "" },
  ];
  it("goleadores sin contar autogoles", () => {
    const e = [ev("x", "A", "gol", "p1"), ev("x", "A", "gol", "p1"), ev("x", "B", "gol", "p2"), ev("x", "B", "autogol", "p2")];
    expect(topScorers(e, players)).toEqual([{ playerId: "p1", teamId: "A", goals: 2 }, { playerId: "p2", teamId: "B", goals: 1 }]);
  });
  it("valla menos vencida por promedio", () => {
    const d = bestDefense([m("A", "B", 1, 0), m("A", "C", 0, 0), m("B", "C", 3, 2)]);
    expect(d[0]).toMatchObject({ teamId: "A", against: 0 });
  });
  it("podio desde la fase final", () => {
    const ms = [m("A", "C", 2, 1, { stage: "final" }), m("D", "B", 0, 0, { stage: "tercer_puesto", home_penalties: 5, away_penalties: 4 })];
    expect(computePodium(ms, [])).toEqual(["A", "C", "D", "B"]);
  });
  it("podio desde la tabla cuando no hay fase final", () => {
    const ms = [m("A", "B", 2, 0), m("B", "C", 1, 0), m("A", "C", 1, 0)];
    const t = computeStandings(["A", "B", "C"], ms, [], rules);
    expect(computePodium(ms, t)).toEqual(["A", "B", "C", null]);
  });
});
