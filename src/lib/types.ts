// Tipos del dominio. Reflejan las tablas de supabase/migrations/*_schema.sql

export type StaffRole = "admin" | "organizador" | "planillero" | "delegado";
export type EditionStatus = "planificacion" | "inscripcion" | "en_desarrollo" | "finalizado";
export type Branch = "masculino" | "femenino" | "mixto" | "veteranos";
export type Format = "todos_contra_todos" | "grupos" | "cuadrangular" | "octagonal";
export type MatchStage = "liga" | "grupo" | "octavos" | "cuartos" | "semifinal" | "tercer_puesto" | "final";
export type MatchStatus = "programado" | "en_juego" | "finalizado" | "aplazado" | "cancelado";
export type EventType = "gol" | "autogol" | "amarilla" | "roja";
export type Tiebreaker = "puntos" | "diferencia" | "juego_limpio" | "goles_favor";
export type NoticeKind = "partido" | "comunidad" | "ventas";
export type CrestShape = "escudo" | "circulo" | "hexagono" | "diamante";

export interface Profile { id: string; full_name: string; role: StaffRole; team_id: string | null }
export interface Sport { id: string; name: string; active: boolean; score_label: string }
export interface Vereda { id: string; name: string; municipality: string }

export interface Edition {
  id: string; name: string; year: number;
  start_date: string | null; end_date: string | null;
  status: EditionStatus; based_on: string | null; created_at: string;
}

export interface Category {
  id: string; edition_id: string; sport_id: string; branch: Branch; name: string;
  format: Format; group_count: number; knockout_size: number; third_place: boolean;
  points_win: number; points_draw: number; points_loss: number;
  tiebreakers: Tiebreaker[]; created_at: string;
}

export interface Team {
  id: string; name: string; short_name: string | null; vereda_id: string | null;
  crest_shape: CrestShape; color_primary: string; color_secondary: string;
  crest_url: string | null; created_at: string;
}

export interface Player { id: string; team_id: string; full_name: string; number: number | null; active: boolean; created_at: string }
export interface CategoryTeam { category_id: string; team_id: string; group_label: string | null }

export interface Match {
  id: string; category_id: string; stage: MatchStage; group_label: string | null;
  round: number; bracket_slot: number | null;
  home_team_id: string | null; away_team_id: string | null;
  scheduled_at: string | null; venue: string | null; status: MatchStatus;
  home_score: number | null; away_score: number | null;
  home_penalties: number | null; away_penalties: number | null;
  notes: string | null; updated_at: string;
}

export interface MatchEvent { id: string; match_id: string; team_id: string; player_id: string | null; type: EventType; minute: number | null; created_at: string }

export interface MatchReport {
  id: string; match_id: string; submitted_by: string; status: "pendiente" | "aprobado" | "rechazado";
  data: { home_score: number; away_score: number; home_penalties?: number | null; away_penalties?: number | null;
          events: Array<Pick<MatchEvent, "team_id" | "player_id" | "type" | "minute">> };
  review_note: string | null; created_at: string;
}

export interface PodiumEntry { category_id: string; position: 1 | 2 | 3 | 4; team_id: string }
export interface Notice { id: string; title: string; body: string | null; kind: NoticeKind; starts_at: string; ends_at: string | null; active: boolean; created_at: string }
export interface GalleryPhoto { id: string; edition_id: string; storage_path: string; caption: string | null; created_at: string }

/** Todas las tablas que la app maneja, con su tipo de fila. */
export interface Tables {
  profiles: Profile; sports: Sport; veredas: Vereda; editions: Edition; categories: Category;
  teams: Team; players: Player; category_teams: CategoryTeam; matches: Match;
  match_events: MatchEvent; match_reports: MatchReport; category_podium: PodiumEntry;
  notices: Notice; gallery_photos: GalleryPhoto;
}
export type TableName = keyof Tables;
