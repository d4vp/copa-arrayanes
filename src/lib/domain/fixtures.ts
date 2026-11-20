import type { Match, MatchStage } from "../types";
import { GROUP_LABELS, stageForSize } from "./formats";

/** Partido sin identificador ni datos de servidor: lo que produce el generador. */
export type DraftMatch = Pick<Match,
  "category_id" | "stage" | "group_label" | "round" | "bracket_slot" | "home_team_id" | "away_team_id"> & {
  scheduled_at?: string | null;
};

/**
 * Todos contra todos por el método del círculo.
 * Con número impar de equipos, uno descansa cada fecha.
 * Alterna local/visitante para equilibrar.
 */
export function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  if (teamIds.length < 2) return [];
  const list: Array<string | null> = [...teamIds];
  if (list.length % 2 === 1) list.push(null); // descanso
  const n = list.length;
  const rounds: Array<Array<[string, string]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 || i > 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // rotar dejando fijo el primero
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Reparte equipos en grupos en zigzag (A B C C B A ...) para equilibrar cabezas de serie. */
export function splitIntoGroups(teamIds: string[], groupCount: number): Record<string, string[]> {
  const count = Math.max(1, Math.min(groupCount, GROUP_LABELS.length));
  const groups: Record<string, string[]> = {};
  for (let g = 0; g < count; g++) groups[GROUP_LABELS[g]] = [];
  teamIds.forEach((id, i) => {
    const lap = Math.floor(i / count);
    const pos = i % count;
    const g = lap % 2 === 0 ? pos : count - 1 - pos;
    groups[GROUP_LABELS[g]].push(id);
  });
  return groups;
}

/** Genera la fase regular (liga o grupos) de una categoría. */
export function generateGroupStage(
  categoryId: string,
  groups: Record<string, string[]>,
): DraftMatch[] {
  const labels = Object.keys(groups);
  const single = labels.length === 1;
  const out: DraftMatch[] = [];
  for (const label of labels) {
    roundRobin(groups[label]).forEach((pairs, r) => {
      for (const [home, away] of pairs) {
        out.push({
          category_id: categoryId,
          stage: single ? "liga" : "grupo",
          group_label: single ? null : label,
          round: r + 1,
          bracket_slot: null,
          home_team_id: home,
          away_team_id: away,
        });
      }
    });
  }
  return out;
}

/**
 * Cruces de eliminación directa a partir de los clasificados ya ordenados
 * (1° contra último, 2° contra penúltimo...). Con grupos, se cruzan para
 * que equipos del mismo grupo no se enfrenten en la primera ronda.
 */
export function seedKnockout(qualifiedByGroup: Record<string, string[]>, size: number): Array<[string, string]> {
  const labels = Object.keys(qualifiedByGroup);
  if (labels.length === 1) {
    const q = qualifiedByGroup[labels[0]].slice(0, size);
    return Array.from({ length: size / 2 }, (_, i) => [q[i], q[size - 1 - i]] as [string, string]);
  }
  // Grupos: 1A vs 2B, 1B vs 2A, 1C vs 2D ...
  const perGroup = size / labels.length;
  const pairs: Array<[string, string]> = [];
  if (Number.isInteger(perGroup) && perGroup === 2 && labels.length % 2 === 0) {
    for (let i = 0; i < labels.length; i += 2) {
      const g1 = qualifiedByGroup[labels[i]], g2 = qualifiedByGroup[labels[i + 1]];
      pairs.push([g1[0], g2[1]], [g2[0], g1[1]]);
    }
    return pairs;
  }
  // Caso general: tabla combinada por posición en el grupo
  const merged: string[] = [];
  const depth = Math.max(...labels.map((l) => qualifiedByGroup[l].length));
  for (let p = 0; p < depth; p++) for (const l of labels) if (qualifiedByGroup[l][p]) merged.push(qualifiedByGroup[l][p]);
  return seedKnockout({ X: merged }, size);
}

/** Partidos de la primera ronda eliminatoria. */
export function generateKnockoutRound(categoryId: string, pairs: Array<[string, string]>, round: number): DraftMatch[] {
  const stage = stageForSize(pairs.length * 2);
  return pairs.map(([home, away], i) => ({
    category_id: categoryId, stage, group_label: null, round, bracket_slot: i + 1,
    home_team_id: home, away_team_id: away,
  }));
}

/** Ganador de un partido eliminatorio (con penales si hubo empate). null si aún no se define. */
export function knockoutWinner(m: Match): string | null {
  if (m.status !== "finalizado" || m.home_score == null || m.away_score == null) return null;
  if (m.home_score !== m.away_score) return m.home_score > m.away_score ? m.home_team_id : m.away_team_id;
  if (m.home_penalties == null || m.away_penalties == null || m.home_penalties === m.away_penalties) return null;
  return m.home_penalties > m.away_penalties ? m.home_team_id : m.away_team_id;
}

export function knockoutLoser(m: Match): string | null {
  const w = knockoutWinner(m);
  if (!w) return null;
  return w === m.home_team_id ? m.away_team_id : m.home_team_id;
}

const NEXT: Partial<Record<MatchStage, MatchStage>> = { octavos: "cuartos", cuartos: "semifinal", semifinal: "final" };

/**
 * Siguiente ronda cuando la actual terminó por completo.
 * Desde semifinales genera la final y, si aplica, el partido por el tercer puesto.
 * Devuelve [] si la ronda no está completa o la siguiente ya existe.
 */
export function nextKnockoutRound(categoryId: string, all: Match[], thirdPlace: boolean): DraftMatch[] {
  const order: MatchStage[] = ["octavos", "cuartos", "semifinal"];
  for (const stage of order) {
    const current = all.filter((m) => m.stage === stage).sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));
    if (current.length === 0) continue;
    const next = NEXT[stage]!;
    if (all.some((m) => m.stage === next)) continue;
    const winners = current.map(knockoutWinner);
    if (winners.some((w) => !w)) return [];
    const round = Math.max(...all.map((m) => m.round)) + 1;
    const out: DraftMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      out.push({ category_id: categoryId, stage: next, group_label: null, round, bracket_slot: i / 2 + 1,
        home_team_id: winners[i], away_team_id: winners[i + 1] });
    }
    if (stage === "semifinal" && thirdPlace) {
      const losers = current.map(knockoutLoser);
      out.push({ category_id: categoryId, stage: "tercer_puesto", group_label: null, round, bracket_slot: 1,
        home_team_id: losers[0], away_team_id: losers[1] });
    }
    return out;
  }
  return [];
}
