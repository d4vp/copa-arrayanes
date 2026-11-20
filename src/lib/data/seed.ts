/**
 * Datos de demostración para el modo local. Nombres ficticios.
 * Sirven para recorrer la app completa antes de conectar Supabase.
 */
import { generateGroupStage, generateKnockoutRound, seedKnockout, splitIntoGroups } from "../domain/fixtures";
import type { Category, Edition, Match, MatchEvent, Notice, Player, Team, Vereda } from "../types";

// Generador pseudoaleatorio con semilla: los datos demo son siempre iguales.
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

export function buildSeed() {
  const rand = rng(2026);
  const id = () => crypto.randomUUID();
  const iso = (d: Date) => d.toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = (offset: number, hour: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return iso(d); };

  const veredas: Vereda[] = ["Los Arrayanes", "El Rosal", "San José", "La Loma", "Santa Rosa", "El Placer"]
    .map((name) => ({ id: id(), name, municipality: "Córdoba (Nariño)" }));

  const palette = [["#1d4ed8", "#ffffff"], ["#15803d", "#ffffff"], ["#0f172a", "#facc15"], ["#b91c1c", "#ffffff"], ["#0e7490", "#f0fdfa"],
    ["#7c3aed", "#ffffff"], ["#ea580c", "#0f172a"], ["#ffffff", "#1d4ed8"], ["#166534", "#fde047"], ["#1e3a8a", "#e0f2fe"], ["#be185d", "#ffffff"], ["#334155", "#38bdf8"]];
  const shapes: Team["crest_shape"][] = ["escudo", "circulo", "hexagono", "diamante"];
  const teamNames = ["Halcones", "Cóndores", "Pumas", "Toros", "Venados", "Águilas", "Jaguares", "Gavilanes", "Las Panteras", "Las Garzas", "Las Gacelas", "Las Colibríes"];
  const teams: Team[] = teamNames.map((name, i) => ({
    id: id(), name, short_name: name.replace(/^Las /, "").slice(0, 3).toUpperCase(),
    vereda_id: veredas[i % veredas.length].id, crest_shape: shapes[i % 4],
    color_primary: palette[i][0], color_secondary: palette[i][1], crest_url: null, created_at: iso(today),
  }));

  const first = ["Andrés", "Carlos", "Diego", "Jhon", "Luis", "Mateo", "Óscar", "Santiago", "Brayan", "Camilo", "Edwin", "Fabián"];
  const firstF = ["Ana", "Camila", "Daniela", "Erika", "Laura", "María", "Paola", "Sofía", "Valentina", "Yuli"];
  const last = ["Arcos", "Benavides", "Cuastumal", "Chamorro", "Erazo", "Guerrero", "Insuasty", "Muñoz", "Pantoja", "Rosero", "Tapia", "Yépez"];
  const players: Player[] = [];
  teams.forEach((t, ti) => {
    const fem = ti >= 8;
    for (let n = 0; n < 8; n++) {
      const f = fem ? firstF[Math.floor(rand() * firstF.length)] : first[Math.floor(rand() * first.length)];
      players.push({ id: id(), team_id: t.id, full_name: `${f} ${last[Math.floor(rand() * last.length)]}`, number: n === 0 ? 1 : n + 6, active: true, created_at: iso(today) });
    }
  });

  const prev: Edition = { id: id(), name: "Copa Arrayanes 2025", year: 2025, start_date: "2025-06-01", end_date: "2025-08-15", status: "finalizado", based_on: null, created_at: iso(today) };
  const cur: Edition = { id: id(), name: "Copa Arrayanes 2026", year: 2026, start_date: day(-14, 0).slice(0, 10), end_date: day(40, 0).slice(0, 10), status: "en_desarrollo", based_on: prev.id, created_at: iso(today) };

  const baseCat = { sport_id: "microfutbol", group_count: 1, knockout_size: 4, third_place: true, points_win: 3, points_draw: 1, points_loss: 0, tiebreakers: ["puntos", "diferencia", "juego_limpio", "goles_favor"] as Category["tiebreakers"], created_at: iso(today) };
  const catMasc: Category = { ...baseCat, id: id(), edition_id: cur.id, branch: "masculino", name: "Microfútbol Masculino", format: "grupos", group_count: 2 };
  const catFem: Category = { ...baseCat, id: id(), edition_id: cur.id, branch: "femenino", name: "Microfútbol Femenino", format: "todos_contra_todos", knockout_size: 2, third_place: false };
  const catPrev: Category = { ...baseCat, id: id(), edition_id: prev.id, branch: "masculino", name: "Microfútbol Masculino", format: "cuadrangular" };

  const masc = teams.slice(0, 8), fem = teams.slice(8);
  const groups = splitIntoGroups(masc.map((t) => t.id), 2);
  const category_teams = [
    ...Object.entries(groups).flatMap(([g, ids]) => ids.map((team_id) => ({ category_id: catMasc.id, team_id, group_label: g }))),
    ...fem.map((t) => ({ category_id: catFem.id, team_id: t.id, group_label: null })),
    ...masc.slice(0, 4).map((t) => ({ category_id: catPrev.id, team_id: t.id, group_label: null })),
  ];

  const matches: Match[] = [];
  const events: MatchEvent[] = [];
  const venues = ["Cancha Los Arrayanes", "Polideportivo veredal"];
  const toMatch = (d: ReturnType<typeof generateGroupStage>[number], when: string, played: boolean): Match => {
    const m: Match = { ...d, id: id(), scheduled_at: when, venue: venues[Math.floor(rand() * 2)], status: "programado",
      home_score: null, away_score: null, home_penalties: null, away_penalties: null, notes: null, updated_at: iso(today) };
    if (played) {
      m.status = "finalizado"; m.home_score = Math.floor(rand() * 5); m.away_score = Math.floor(rand() * 4);
      for (const [team, goals] of [[m.home_team_id!, m.home_score], [m.away_team_id!, m.away_score]] as const) {
        const roster = players.filter((p) => p.team_id === team);
        for (let g = 0; g < goals; g++) events.push({ id: id(), match_id: m.id, team_id: team, player_id: roster[1 + Math.floor(rand() * 7)].id, type: "gol", minute: 1 + Math.floor(rand() * 40), created_at: iso(today) });
        if (rand() < 0.5) events.push({ id: id(), match_id: m.id, team_id: team, player_id: roster[Math.floor(rand() * 8)].id, type: "amarilla", minute: Math.floor(rand() * 40), created_at: iso(today) });
        if (rand() < 0.08) events.push({ id: id(), match_id: m.id, team_id: team, player_id: roster[Math.floor(rand() * 8)].id, type: "roja", minute: Math.floor(rand() * 40), created_at: iso(today) });
      }
    }
    return m;
  };

  // Masculino: fechas 1 y 2 jugadas, fecha 3 programada (hoy y próximos días)
  generateGroupStage(catMasc.id, groups).forEach((d, i) => {
    const offset = d.round === 1 ? -7 : d.round === 2 ? -1 : 2 + (i % 2);
    matches.push(toMatch(d, day(offset, 14 + (i % 4)), d.round < 3));
  });
  // Femenino
  generateGroupStage(catFem.id, { A: fem.map((t) => t.id) }).forEach((d, i) => {
    const offset = d.round === 1 ? -6 : d.round === 2 ? 0 : 5;
    matches.push(toMatch(d, day(offset, 13 + (i % 2) * 3), d.round === 1));
  });
  // Edición anterior: cuadrangular completo
  const pairs = seedKnockout({ A: masc.slice(0, 4).map((t) => t.id) }, 4);
  const semis = generateKnockoutRound(catPrev.id, pairs, 1).map((d, i) => ({ ...toMatch(d, `2025-08-0${i + 1}T20:00:00.000Z`, false), status: "finalizado" as const, home_score: 2, away_score: 1 }));
  const final: Match = { ...toMatch({ category_id: catPrev.id, stage: "final", group_label: null, round: 2, bracket_slot: 1, home_team_id: semis[0].home_team_id, away_team_id: semis[1].home_team_id }, "2025-08-15T20:00:00.000Z", false), status: "finalizado", home_score: 3, away_score: 3, home_penalties: 4, away_penalties: 2 };
  const third: Match = { ...toMatch({ category_id: catPrev.id, stage: "tercer_puesto", group_label: null, round: 2, bracket_slot: 1, home_team_id: semis[0].away_team_id, away_team_id: semis[1].away_team_id }, "2025-08-15T18:00:00.000Z", false), status: "finalizado", home_score: 1, away_score: 0 };
  matches.push(...semis, final, third);
  const category_podium = [
    { category_id: catPrev.id, position: 1 as const, team_id: final.home_team_id! },
    { category_id: catPrev.id, position: 2 as const, team_id: final.away_team_id! },
    { category_id: catPrev.id, position: 3 as const, team_id: third.home_team_id! },
    { category_id: catPrev.id, position: 4 as const, team_id: third.away_team_id! },
  ];

  const notices: Notice[] = [
    { id: id(), title: "Venta de empanadas y champús", body: "Junta de Acción Comunal · Toda la jornada junto a la cancha.", kind: "ventas", starts_at: day(-1, 0), ends_at: day(10, 0), active: true, created_at: iso(today) },
    { id: id(), title: "Minga para arreglar la cancha", body: "Sábado 7:00 a. m. Traer herramienta.", kind: "comunidad", starts_at: day(-1, 0), ends_at: day(6, 0), active: true, created_at: iso(today) },
  ];

  return {
    profiles: [], sports: [
      { id: "microfutbol", name: "Microfútbol", active: true, score_label: "goles" },
      { id: "baloncesto", name: "Baloncesto", active: true, score_label: "puntos" },
    ],
    veredas, editions: [prev, cur], categories: [catPrev, catMasc, catFem], teams, players, category_teams,
    matches, match_events: events, match_reports: [], category_podium, notices, gallery_photos: [],
  };
}
