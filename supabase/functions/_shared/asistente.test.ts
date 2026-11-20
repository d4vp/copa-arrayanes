/* eslint-disable @typescript-eslint/no-explicit-any -- pruebas de forma de JSON libre */
import { describe, expect, it } from "vitest";
import { buildJsonSchema, buildMessages, type Candidate, localParse, sanitizeResult, validateRequest } from "./asistente";

const c1: Candidate = {
  match_id: "m1", label: "Halcones vs Toros", knockout: false,
  home: { id: "H", name: "Halcones", short_name: "HAL", players: [{ id: "h9", name: "Camilo Rosero", number: 9 }, { id: "h10", name: "Andrés Erazo", number: 10 }] },
  away: { id: "T", name: "Toros", short_name: "TOR", players: [{ id: "t7", name: "Luis Pantoja", number: 7 }] },
};
const c2: Candidate = {
  match_id: "m2", label: "Pumas vs Venados", knockout: true,
  home: { id: "P", name: "Pumas", short_name: null, players: [{ id: "p1", name: "Diego Muñoz", number: 1 }] },
  away: { id: "V", name: "Venados", short_name: null, players: [{ id: "v5", name: "Óscar Tapia", number: 5 }] },
};

describe("validateRequest", () => {
  it("exige texto o foto", () => expect(validateRequest({ candidates: [c1] })).toMatch(/Dicta/));
  it("rechaza formatos de imagen extraños", () => expect(validateRequest({ candidates: [c1], images: ["data:text/html;base64,xx"] })).toMatch(/Formato/));
  it("acepta dictado válido", () => expect(validateRequest({ candidates: [c1], text: "Halcones 2 Toros 1" })).toBeNull());
});

describe("esquema y mensajes para la IA", () => {
  it("restringe ids con enum (incluye null para jugador)", () => {
    const s = buildJsonSchema([c1, c2]) as any;
    const item = s.properties.results.items;
    expect(item.properties.match_id.enum).toEqual(["m1", "m2"]);
    expect(item.properties.events.items.properties.player_id.enum).toContain(null);
    expect(item.required).toEqual(Object.keys(item.properties));
  });
  it("incluye fotos como image_url", () => {
    const msgs = buildMessages({ candidates: [c1], images: ["data:image/jpeg;base64,AAA"] }) as any;
    expect(msgs[1].content.some((x: any) => x.type === "image_url")).toBe(true);
  });
});

describe("sanitizeResult: no se confía en el modelo", () => {
  it("descarta ids inventados, corrige equipo por jugador y limita números", () => {
    const out = sanitizeResult({
      results: [
        { match_id: "inventado", home_score: 1, away_score: 0, events: [] },
        { match_id: "m1", home_score: 150, away_score: -3, home_penalties: 4, away_penalties: 3, confidence: "rara",
          events: [
            { team_id: "T", player_id: "h9", type: "gol" },          // jugador de H marcado como T → se corrige
            { team_id: "X", player_id: null, type: "gol" },          // equipo ajeno → se descarta
            { team_id: "T", player_id: "fantasma", player_raw: "Lucho", type: "amarilla" },
            { team_id: "H", player_id: null, type: "penal" },        // tipo inválido
          ] },
        { match_id: "m1", home_score: 9, away_score: 9, events: [] }, // duplicado
      ],
    }, [c1, c2]);
    expect(out.results).toHaveLength(1);
    const r = out.results[0];
    expect([r.home_score, r.away_score, r.home_penalties]).toEqual([99, 0, null]);
    expect(r.confidence).toBe("media");
    expect(r.events).toEqual([
      { team_id: "H", player_id: "h9", player_raw: null, type: "gol", minute: null },
      { team_id: "T", player_id: null, player_raw: "Lucho", type: "amarilla", minute: null },
    ]);
  });
  it("conserva penales solo en eliminatoria empatada", () => {
    const out = sanitizeResult({ results: [{ match_id: "m2", home_score: 1, away_score: 1, home_penalties: 4, away_penalties: 2, events: [] }] }, [c2]);
    expect([out.results[0].home_penalties, out.results[0].away_penalties]).toEqual([4, 2]);
  });
});

describe("localParse: lector gratuito de dictado", () => {
  it("lee varios partidos, números en palabras y errores de voz", () => {
    const out = localParse("Alcones tres Toros uno, goles de Camilo y dos goles de Andrés, amarilla para Pantoja. Pumas cero Venados cero", [c1, c2]);
    expect(out.source).toBe("local");
    const m1 = out.results.find((r) => r.match_id === "m1")!;
    expect([m1.home_score, m1.away_score]).toEqual([3, 1]);
    expect(m1.events.filter((e) => e.type === "gol").map((e) => e.player_id).sort()).toEqual(["h10", "h10", "h9"]);
    expect(m1.events.find((e) => e.type === "amarilla")?.player_id).toBe("t7");
    const m2 = out.results.find((r) => r.match_id === "m2")!;
    expect([m2.home_score, m2.away_score]).toEqual([0, 0]);
  });
  it("entiende cuando se nombra primero al visitante", () => {
    const out = localParse("Toros 2, Halcones 4", [c1]);
    expect([out.results[0].home_score, out.results[0].away_score]).toEqual([4, 2]);
  });
  it("entiende empates dichos con palabra", () => {
    const out = localParse("Halcones y Toros empataron a dos", [c1]);
    expect([out.results[0].home_score, out.results[0].away_score]).toEqual([2, 2]);
  });
  it("explica cuando no entiende", () => {
    const out = localParse("hoy llovió mucho", [c1]);
    expect(out.results).toHaveLength(0);
    expect(out.not_understood).toMatch(/Prueba/);
  });
});
