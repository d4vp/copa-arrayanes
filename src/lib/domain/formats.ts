import type { Format, MatchStage } from "../types";

export interface FormatPreset {
  label: string;
  description: string;
  /** Equipos mínimos recomendados */
  minTeams: number;
  groupCount: number;
  knockoutSize: 0 | 2 | 4 | 8 | 16;
}

/**
 * Formatos usados en los campeonatos veredales.
 * Son puntos de partida: grupos y tamaño de la llave se pueden ajustar.
 */
export const FORMATS: Record<Format, FormatPreset> = {
  todos_contra_todos: {
    label: "Todos contra todos",
    description: "Liga a una vuelta. Los mejores 4 juegan semifinales y final.",
    minTeams: 3, groupCount: 1, knockoutSize: 4,
  },
  grupos: {
    label: "Fase de grupos",
    description: "Grupos todos contra todos. Los mejores avanzan a eliminación directa.",
    minTeams: 6, groupCount: 2, knockoutSize: 4,
  },
  cuadrangular: {
    label: "Cuadrangular",
    description: "Clasifican 4 equipos: semifinales, tercer puesto y final.",
    minTeams: 4, groupCount: 1, knockoutSize: 4,
  },
  octagonal: {
    label: "Octagonal",
    description: "Clasifican 8 equipos: cuartos, semifinales, tercer puesto y final.",
    minTeams: 8, groupCount: 2, knockoutSize: 8,
  },
};

export const STAGE_LABEL: Record<MatchStage, string> = {
  liga: "Fecha",
  grupo: "Grupo",
  octavos: "Octavos de final",
  cuartos: "Cuartos de final",
  semifinal: "Semifinal",
  tercer_puesto: "Tercer puesto",
  final: "Final",
};

export const KNOCKOUT_STAGES: MatchStage[] = ["octavos", "cuartos", "semifinal", "tercer_puesto", "final"];

export function stageForSize(size: number): MatchStage {
  if (size >= 16) return "octavos";
  if (size >= 8) return "cuartos";
  if (size >= 4) return "semifinal";
  return "final";
}

export const GROUP_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
