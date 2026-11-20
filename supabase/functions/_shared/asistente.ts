/**
 * Asistente de planilla: lógica compartida entre la app (Next.js) y la Edge Function (Deno).
 * Sin dependencias externas para que funcione en ambos entornos.
 *
 *  - buildJsonSchema: formato estricto que debe devolver el modelo (ids cerrados con enum).
 *  - buildMessages:   instrucciones + partidos candidatos + texto dictado + fotos.
 *  - sanitizeResult:  valida y corrige lo que devuelve el modelo (nunca se confía a ciegas).
 *  - localParse:      lector de dictado GRATUITO sin IA (frases simples).
 */

export type EventType = "gol" | "autogol" | "amarilla" | "roja";
export type Confidence = "alta" | "media" | "baja";

export interface CandidatePlayer { id: string; name: string; number: number | null }
export interface CandidateTeam { id: string; name: string; short_name: string | null; players: CandidatePlayer[] }
export interface Candidate { match_id: string; label: string; knockout: boolean; home: CandidateTeam; away: CandidateTeam }

export interface AssistantRequest {
  candidates: Candidate[];
  text?: string;
  /** data URLs JPEG/WebP ya comprimidas en el teléfono */
  images?: string[];
}

export interface AssistantEvent { team_id: string; player_id: string | null; player_raw: string | null; type: EventType; minute: number | null }
export interface AssistantMatch {
  match_id: string;
  home_score: number; away_score: number;
  home_penalties: number | null; away_penalties: number | null;
  events: AssistantEvent[];
  confidence: Confidence;
  note: string | null;
}
export interface AssistantResult { results: AssistantMatch[]; not_understood: string | null; source: "ia" | "local" }

export const LIMITS = { candidates: 12, images: 3, imageChars: 2_000_000, text: 4000, eventsPerMatch: 60 } as const;

/** Valida la solicitud antes de gastar una llamada al modelo. Devuelve mensaje de error o null. */
export function validateRequest(req: AssistantRequest): string | null {
  if (!req || !Array.isArray(req.candidates) || req.candidates.length === 0) return "Elige al menos un partido.";
  if (req.candidates.length > LIMITS.candidates) return `Máximo ${LIMITS.candidates} partidos por consulta.`;
  const text = (req.text ?? "").trim();
  const images = req.images ?? [];
  if (!text && images.length === 0) return "Dicta, escribe o envía una foto del resultado.";
  if (text.length > LIMITS.text) return "El texto es demasiado largo.";
  if (images.length > LIMITS.images) return `Máximo ${LIMITS.images} fotos por consulta.`;
  for (const img of images) {
    if (typeof img !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(img)) return "Formato de foto no válido.";
    if (img.length > LIMITS.imageChars) return "Una foto es demasiado pesada.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Modelo de IA
// ---------------------------------------------------------------------------

/** JSON Schema estricto: el modelo solo puede elegir ids que existen. */
export function buildJsonSchema(candidates: Candidate[]) {
  const matchIds = candidates.map((c) => c.match_id);
  const teamIds = [...new Set(candidates.flatMap((c) => [c.home.id, c.away.id]))];
  const playerIds = [...new Set(candidates.flatMap((c) => [...c.home.players, ...c.away.players].map((p) => p.id)))];
  const nullableInt = { type: ["integer", "null"] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["results", "not_understood"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["match_id", "home_score", "away_score", "home_penalties", "away_penalties", "events", "confidence", "note"],
          properties: {
            match_id: { type: "string", enum: matchIds },
            home_score: { type: "integer" },
            away_score: { type: "integer" },
            home_penalties: nullableInt,
            away_penalties: nullableInt,
            events: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["team_id", "player_id", "player_raw", "type", "minute"],
                properties: {
                  team_id: { type: "string", enum: teamIds },
                  player_id: { type: ["string", "null"], enum: [...playerIds, null] },
                  player_raw: { type: ["string", "null"] },
                  type: { type: "string", enum: ["gol", "autogol", "amarilla", "roja"] },
                  minute: nullableInt,
                },
              },
            },
            confidence: { type: "string", enum: ["alta", "media", "baja"] },
            note: { type: ["string", "null"] },
          },
        },
      },
      not_understood: { type: ["string", "null"] },
    },
  };
}

export const SYSTEM_PROMPT = `Eres el asistente del planillero de un campeonato veredal de microfútbol en Nariño, Colombia.
Recibes partidos candidatos (con ids, equipos y jugadores) y un dictado y/o fotos de la planilla escrita a mano.
Tu tarea: extraer el resultado de cada partido mencionado.

Reglas:
- Usa SOLO los ids de los candidatos. Incluye únicamente partidos que realmente aparezcan; no inventes resultados.
- home = equipo local (el primero del candidato). Si el texto nombra primero al visitante, asigna bien cada marcador.
- El dictado puede tener errores de reconocimiento de voz ("Alcones" = "Halcones"). Usa el parecido con los nombres.
- Números en palabras ("tres a uno") son marcadores. "Empate a dos" = 2-2.
- Eventos: "gol de X" → gol del equipo de X. "autogol de X" → type autogol con team_id del equipo de X (el que lo cometió).
  "amarilla/tarjeta a X" → amarilla; "roja/expulsado X" → roja. "Dos goles de X" → dos eventos.
- Si un jugador se identifica por número de camiseta, búscalo por número en el equipo correcto.
- Si no estás seguro de qué jugador es, usa player_id null y escribe lo que leíste en player_raw.
- Penales solo si es eliminatoria y empataron; si no, null.
- No es obligatorio que la suma de goles con jugador coincida con el marcador (la planilla puede estar incompleta).
- confidence: "alta" si se lee claro; "media" si hubo que interpretar; "baja" si hay dudas importantes. Explica dudas en note (corto, en español).
- not_understood: lo que no pudiste asignar a ningún partido, o null.`;

/** Mensajes en formato Chat Completions (texto + imágenes). */
export function buildMessages(req: AssistantRequest) {
  const context = req.candidates.map((c) => ({
    match_id: c.match_id,
    partido: c.label,
    eliminatoria: c.knockout,
    local: { team_id: c.home.id, nombre: c.home.name, sigla: c.home.short_name, jugadores: c.home.players.map((p) => ({ id: p.id, n: p.number, nombre: p.name })) },
    visitante: { team_id: c.away.id, nombre: c.away.name, sigla: c.away.short_name, jugadores: c.away.players.map((p) => ({ id: p.id, n: p.number, nombre: p.name })) },
  }));
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `PARTIDOS CANDIDATOS:\n${JSON.stringify(context)}` },
  ];
  if (req.text?.trim()) content.push({ type: "text", text: `DICTADO / TEXTO DEL PLANILLERO:\n${req.text.trim()}` });
  for (const url of req.images ?? []) content.push({ type: "image_url", image_url: { url, detail: "high" } });
  if (req.images?.length) content.push({ type: "text", text: "Las imágenes son fotos de la planilla o del tablero con los resultados." });
  return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }];
}

// ---------------------------------------------------------------------------
// Validación de la respuesta
// ---------------------------------------------------------------------------

const clampInt = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** Nunca se confía en el modelo: se filtran ids, equipos, jugadores y números fuera de rango. */
export function sanitizeResult(raw: unknown, candidates: Candidate[], source: "ia" | "local" = "ia"): AssistantResult {
  const obj = (raw ?? {}) as { results?: unknown; not_understood?: unknown };
  const byId = new Map(candidates.map((c) => [c.match_id, c]));
  const seen = new Set<string>();
  const results: AssistantMatch[] = [];
  for (const r of Array.isArray(obj.results) ? obj.results : []) {
    const x = (r ?? {}) as Record<string, unknown>;
    const c = byId.get(String(x.match_id));
    if (!c || seen.has(c.match_id)) continue;
    seen.add(c.match_id);
    const hs = clampInt(x.home_score, 0, 99), as = clampInt(x.away_score, 0, 99);
    if (hs === null || as === null) continue;
    let hp = clampInt(x.home_penalties, 0, 50), ap = clampInt(x.away_penalties, 0, 50);
    if (!c.knockout || hs !== as || hp === null || ap === null) { hp = null; ap = null; }
    const roster = new Map([...c.home.players.map((p) => [p.id, c.home.id] as const), ...c.away.players.map((p) => [p.id, c.away.id] as const)]);
    const events: AssistantEvent[] = [];
    for (const e of Array.isArray(x.events) ? x.events.slice(0, LIMITS.eventsPerMatch) : []) {
      const ev = (e ?? {}) as Record<string, unknown>;
      const type = ev.type as EventType;
      if (!["gol", "autogol", "amarilla", "roja"].includes(type)) continue;
      let team = String(ev.team_id);
      const player = typeof ev.player_id === "string" && roster.has(ev.player_id) ? ev.player_id : null;
      if (player) team = roster.get(player)!; // el jugador manda: corrige el equipo si el modelo se equivocó
      if (team !== c.home.id && team !== c.away.id) continue;
      const rawName = typeof ev.player_raw === "string" ? ev.player_raw.slice(0, 80) : null;
      events.push({ team_id: team, player_id: player, player_raw: player ? null : rawName, type, minute: clampInt(ev.minute, 0, 200) });
    }
    const confidence = (["alta", "media", "baja"] as const).includes(x.confidence as Confidence) ? (x.confidence as Confidence) : "media";
    results.push({ match_id: c.match_id, home_score: hs, away_score: as, home_penalties: hp, away_penalties: ap, events, confidence,
      note: typeof x.note === "string" && x.note.trim() ? x.note.slice(0, 300) : null });
  }
  const nu = typeof obj.not_understood === "string" && obj.not_understood.trim() ? obj.not_understood.slice(0, 500) : null;
  return { results, not_understood: nu, source };
}

// ---------------------------------------------------------------------------
// Lector de dictado gratuito (sin IA)
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
};
const STOP = new Set(["los", "las", "el", "la", "de", "del", "fc", "club", "deportivo"]);

export function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
}

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** ¿La palabra del dictado se parece a la palabra clave? Tolera errores del reconocimiento de voz. */
function similar(word: string, key: string) {
  if (word === key) return true;
  if (key.length >= 5) return lev(word, key) <= (key.length >= 8 ? 2 : 1);
  return false;
}

const keyWords = (name: string) => normalize(name).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));

function toNumber(tok: string | undefined): number | null {
  if (tok === undefined) return null;
  if (/^\d{1,2}$/.test(tok)) return Number(tok);
  return tok in NUMBER_WORDS ? NUMBER_WORDS[tok] : null;
}

/** Posiciones donde se menciona un equipo. */
function teamHits(tokens: string[], team: CandidateTeam): number[] {
  const keys = keyWords(team.name);
  const short = team.short_name ? normalize(team.short_name) : null;
  const hits: number[] = [];
  tokens.forEach((t, i) => { if (keys.some((k) => similar(t, k)) || (short && t === short)) hits.push(i); });
  return hits;
}

/**
 * Lee frases como:
 *   "Halcones 3 Toros 1, goles de Camilo y dos de Andrés, amarilla para Pérez.
 *    Pumas cero Venados cero"
 * Para cada partido busca un número justo después de cada equipo.
 */
export function localParse(text: string, candidates: Candidate[]): AssistantResult {
  const tokens = normalize(text).split(" ").filter(Boolean);
  // Ubicar cada partido en el texto (primera mención de cualquiera de sus equipos)
  const located = candidates
    .map((c) => {
      const h = teamHits(tokens, c.home), a = teamHits(tokens, c.away);
      return { c, h, a, start: Math.min(h[0] ?? Infinity, a[0] ?? Infinity) };
    })
    .filter((x) => x.h.length && x.a.length)
    .sort((x, y) => x.start - y.start);

  const results: AssistantMatch[] = [];
  located.forEach(({ c, h, a, start }, idx) => {
    const end = located[idx + 1]?.start ?? tokens.length;
    const scoreAfter = (hits: number[]) => {
      for (const i of hits) {
        if (i < start || i >= end) continue;
        for (let k = i + 1; k <= i + 3 && k < end; k++) {
          const n = toNumber(tokens[k]);
          if (n !== null) return n;
          if (teamHits([tokens[k]], c.home).length || teamHits([tokens[k]], c.away).length) break;
        }
      }
      return null;
    };
    let hs = scoreAfter(h), as = scoreAfter(a);
    const seg = tokens.slice(start, end);
    // "empate a dos" / "empataron dos a dos"
    const emp = seg.findIndex((t) => t.startsWith("empat"));
    if ((hs === null || as === null) && emp >= 0) {
      const n = toNumber(seg[emp + 1]) ?? toNumber(seg[emp + 2]);
      if (n !== null) { hs = n; as = n; }
    }
    if (hs === null || as === null) return;

    // Eventos
    const players = [...c.home.players.map((p) => ({ ...p, team: c.home.id })), ...c.away.players.map((p) => ({ ...p, team: c.away.id }))];
    const findPlayer = (from: number) => {
      for (let k = from; k < Math.min(seg.length, from + 6); k++) {
        const w = seg[k];
        const num = /^\d{1,2}$/.test(w) && ["numero", "camiseta", "el"].includes(seg[k - 1] ?? "") ? Number(w) : null;
        const matches = players.filter((p) => num !== null ? p.number === num : keyWords(p.name).some((pw) => similar(w, pw)));
        if (matches.length === 1) return { player: matches[0], at: k };
      }
      return null;
    };
    const events: AssistantEvent[] = [];
    for (let i = 0; i < seg.length; i++) {
      const w = seg[i];
      const type: EventType | null = w.startsWith("autogol") ? "autogol" : /^gol(es|azo)?$/.test(w) ? "gol"
        : w.startsWith("amarilla") ? "amarilla" : w === "roja" || w.startsWith("expuls") ? "roja" : null;
      if (!type) continue;
      const count = toNumber(seg[i - 1]) ?? 1;
      const found = findPlayer(i + 1);
      if (!found) continue;
      for (let n = 0; n < Math.min(count, 10); n++) events.push({ team_id: found.player.team, player_id: found.player.id, player_raw: null, type, minute: null });
      // "goles de Camilo y Andrés": siguiente nombre tras "y"
      let k = found.at + 1;
      while (seg[k] === "y" && type === "gol") {
        const next = findPlayer(k + 1);
        if (!next || next.at > k + 2) break;
        events.push({ team_id: next.player.team, player_id: next.player.id, player_raw: null, type, minute: null });
        k = next.at + 1;
      }
    }
    results.push({ match_id: c.match_id, home_score: hs, away_score: as, home_penalties: null, away_penalties: null, events, confidence: "media",
      note: "Leído sin IA: revisa marcador y jugadores." });
  });
  return sanitizeResult({ results, not_understood: results.length ? null : "No reconocí equipos y marcadores. Prueba: «Halcones 3 Toros 1, gol de Camilo»." }, candidates, "local");
}
