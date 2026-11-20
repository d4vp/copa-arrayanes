"use client";

/**
 * Animaciones deportivas de Copa Arrayanes.
 * Todo es SVG + CSS (sin librerías): pesa poco y respeta "reducir movimiento".
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/data/store";
import type { Match, Team } from "@/lib/types";
import { Crest } from "./crest";

// ---------------------------------------------------------------------------
// Balones
// ---------------------------------------------------------------------------

export function SoccerBall({ className = "size-6", spin = false }: { className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g className={spin ? "ball-spin" : undefined} style={{ transformOrigin: "16px 16px" }}>
        <circle cx="16" cy="16" r="15" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M16 9.5 21.5 13.5 19.4 20H12.6L10.5 13.5Z" fill="#0f172a" />
        <path d="M16 9.5V3M21.5 13.5l6-2M19.4 20l3.6 5.4M12.6 20 9 25.4M10.5 13.5l-6-2" stroke="#0f172a" strokeWidth="1.4" />
        <path d="M13 2.6 16 3l3-.4M27.2 9.4l.9 2.9-1 3M24.6 27l-1.6-1.6.3-2.6M7.4 27l1.6-1.6-.3-2.6M4.8 9.4l-.9 2.9 1 3" stroke="#0f172a" strokeWidth="1.4" fill="none" />
      </g>
    </svg>
  );
}

export function BasketBall({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#f97316" stroke="#7c2d12" strokeWidth="1.5" />
      <path d="M1 16h30M16 1v30M5.5 5.5c4 4 4 17 0 21M26.5 5.5c-4 4-4 17 0 21" stroke="#7c2d12" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Niño corriendo con balón (cargas y bienvenida)
// ---------------------------------------------------------------------------

/** Silueta de jugador corriendo y conduciendo el balón, con el pasto desplazándose. */
export function RunningKid({ className = "h-24 w-36", color = "var(--brand)", jersey = "var(--accent)" }: { className?: string; color?: string; jersey?: string }) {
  return (
    <svg viewBox="0 0 150 100" className={className} role="img" aria-label="Jugador corriendo con el balón">
      {/* pasto que se desplaza: sensación de carrera */}
      <g className="grass-move">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 26} y="90" width="14" height="3" rx="1.5" fill="var(--accent)" opacity=".45" />
        ))}
      </g>
      <line x1="0" y1="89" x2="150" y2="89" stroke="var(--accent)" strokeWidth="1.5" opacity=".6" />
      <ellipse cx="60" cy="89" rx="16" ry="2.5" fill="#000" opacity=".12" className="shadow-pulse" />

      <g className="kid-bob"><g transform="rotate(8 60 60)">
        {/* pierna y brazo traseros (más claros) */}
        <g transform="translate(58 58)"><g className="leg-b"><path d="M0 0 L-2 15 L-1 29" stroke={color} strokeOpacity=".55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></g>
        <g transform="translate(60 33)"><g className="arm-b"><path d="M0 0 L-6 11 L1 18" stroke={color} strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></g>
        {/* torso con camiseta */}
        <path d="M51 30 Q60 25 69 30 L66 54 L54 54 Z" fill={jersey} />
        <path d="M54 53 H66 L67 61 H53 Z" fill={color} opacity=".85" />
        <text x="60" y="47" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="system-ui">10</text>
        {/* cabeza */}
        <circle cx="61" cy="19" r="8.5" fill={color} />
        {/* pierna y brazo delanteros */}
        <g transform="translate(60 58)"><g className="leg-a"><path d="M0 0 L2 15 L1 29" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></g>
        <g transform="translate(61 33)"><g className="arm-a"><path d="M0 0 L6 11 L-1 18" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g></g>
      </g></g>
      {/* balón por delante, rodando y rebotando suave */}
      <g className="ball-dribble"><g transform="translate(86 74)"><SoccerBallInline /></g></g>
    </svg>
  );
}

function SoccerBallInline() {
  return (
    <g className="ball-spin" style={{ transformOrigin: "7px 7px" }}>
      <circle cx="7" cy="7" r="7" fill="#fff" stroke="#0f172a" strokeWidth="1" />
      <path d="M7 4 9.6 5.9 8.6 9H5.4L4.4 5.9Z" fill="#0f172a" />
    </g>
  );
}

const LOADING_LINES = ["Inflando el balón…", "Marcando la cancha…", "Calentando a los jugadores…", "Revisando la tabla…", "Llamando al árbitro…"];

/** Carga con personalidad: jugador corriendo + frases que rotan. */
export function SportsLoader({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => x + 1), 1600); return () => clearInterval(t); }, []);
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center ${compact ? "py-4" : "py-12"}`}>
      <RunningKid className={compact ? "h-24 w-36" : "h-32 w-48"} />
      <p key={i} className="fade-up mt-2 text-sm font-medium text-[var(--muted)]">{LOADING_LINES[i % LOADING_LINES.length]}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partido en vivo
// ---------------------------------------------------------------------------

/** Franja de cancha con el balón moviéndose: va debajo de las tarjetas "En juego". */
export function LiveStrip() {
  return (
    <div aria-hidden className="relative mt-3 h-5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]">
      <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--accent)] opacity-50" />
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)] opacity-50" />
      <div className="live-ball absolute top-0.5"><SoccerBall className="size-4" spin /></div>
    </div>
  );
}

/** Cancha completa con jugada animada: página del partido en vivo. */
export function LivePitch({ home, away }: { home?: Team; away?: Team }) {
  return (
    <div className="relative overflow-hidden rounded-xl" aria-label="Partido en juego">
      <svg viewBox="0 0 300 140" className="block w-full">
        <defs>
          <pattern id="stripes" width="40" height="140" patternUnits="userSpaceOnUse">
            <rect width="20" height="140" fill="#15803d" /><rect x="20" width="20" height="140" fill="#16a34a" />
          </pattern>
        </defs>
        <rect width="300" height="140" fill="url(#stripes)" />
        <g stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" fill="none">
          <rect x="6" y="6" width="288" height="128" rx="2" />
          <line x1="150" y1="6" x2="150" y2="134" /><circle cx="150" cy="70" r="20" />
          <path d="M6 40h28v60H6M294 40h-28v60h28" />
        </g>
        <rect x="1" y="55" width="5" height="30" fill="#fff" opacity=".9" /><rect x="294" y="55" width="5" height="30" fill="#fff" opacity=".9" />
        {/* jugadores (puntos con color de cada equipo) */}
        {[[90, 40], [110, 95], [70, 70]].map(([x, y], k) => <circle key={`h${k}`} className={`player-drift d${k}`} cx={x} cy={y} r="5" fill={home?.color_primary ?? "#1d4ed8"} stroke={home?.color_secondary ?? "#fff"} strokeWidth="1.5" />)}
        {[[200, 45], [185, 100], [230, 70]].map(([x, y], k) => <circle key={`a${k}`} className={`player-drift d${k + 1}`} cx={x} cy={y} r="5" fill={away?.color_primary ?? "#b91c1c"} stroke={away?.color_secondary ?? "#fff"} strokeWidth="1.5" />)}
        <g className="pitch-ball"><circle r="4" fill="#fff" stroke="#0f172a" strokeWidth="1" /></g>
      </svg>
      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-xs font-bold text-white">
        <span className="live-dot size-2 rounded-full bg-rose-400" />EN VIVO
      </span>
    </div>
  );
}

/** Balón que cruza rodando (avisos). Cambia la key para repetir. */
export function RollingBall() {
  return <div aria-hidden className="roll-across pointer-events-none absolute bottom-0.5 left-0"><SoccerBall className="size-4" spin /></div>;
}

// ---------------------------------------------------------------------------
// ¡GOOOL!
// ---------------------------------------------------------------------------

interface GoalInfo { key: string; match: Match; team?: Team; home?: Team; away?: Team }

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.08, dur: 1.4 + (i % 5) * 0.2, rot: (i * 47) % 360 }));

/** Celebración de gol a pantalla completa (se cierra sola). */
export function GoalCelebration({ goal, onClose }: { goal: GoalInfo; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4200); return () => clearTimeout(t); }, [onClose]);
  const colors = [goal.team?.color_primary ?? "#1d4ed8", goal.team?.color_secondary ?? "#fff", "#22c55e", "#facc15"];
  return (
    <div role="alert" aria-live="assertive" onClick={onClose}
      className="goal-backdrop fixed inset-0 z-[60] grid cursor-pointer place-items-center bg-[#0b1220]/70 p-6 backdrop-blur-sm">
      {CONFETTI.map((c, i) => (
        <span key={i} aria-hidden className="confetti absolute top-0 h-3 w-2 rounded-sm"
          style={{ left: `${c.left}%`, background: colors[i % colors.length], animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, rotate: `${c.rot}deg` }} />
      ))}
      <div className="goal-card relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e3a8a] to-[#1d4ed8] p-6 text-center text-white shadow-2xl">
        {/* arco con red y balón entrando */}
        <svg viewBox="0 0 200 90" className="mx-auto h-24 w-full" aria-hidden>
          <g stroke="#fff" strokeOpacity=".35" strokeWidth="1">
            {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={40 + i * 12} y1="14" x2={40 + i * 12} y2="80" className="net-wave" style={{ animationDelay: `${i * 0.03}s` }} />)}
            {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1="40" y1={14 + i * 13} x2="160" y2={14 + i * 13} />)}
          </g>
          <path d="M38 82V12h124v70" stroke="#fff" strokeWidth="5" fill="none" strokeLinejoin="round" />
          <g className="goal-ball"><circle r="9" fill="#fff" stroke="#0f172a" strokeWidth="1.5" /><path d="M0-4 3.8-1.2 2.4 3.2H-2.4L-3.8-1.2Z" fill="#0f172a" /></g>
        </svg>
        <p className="goal-text font-display mt-1 text-6xl font-extrabold tracking-wider">¡GOOOL!</p>
        {goal.team && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <Crest team={goal.team} size={30} /><span className="font-display text-xl font-bold">{goal.team.name}</span>
          </div>
        )}
        <p className="font-display tabular mt-3 text-2xl font-bold text-blue-100">
          {goal.home?.short_name ?? goal.home?.name} {goal.match.home_score} - {goal.match.away_score} {goal.away?.short_name ?? goal.away?.name}
        </p>
        <p className="mt-4 text-xs text-blue-200">Toca para cerrar</p>
      </div>
    </div>
  );
}

/**
 * Observa los marcadores: cuando sube el de un partido en juego,
 * celebra el gol. Prioriza los favoritos del visitante si hay varios.
 */
export function GoalWatcher() {
  const { data, ready } = useStore();
  const prev = useRef<Map<string, [number, number]> | null>(null);
  const [goal, setGoal] = useState<GoalInfo | null>(null);

  useEffect(() => {
    if (!ready) return;
    const now = new Map(data.matches.map((m) => [m.id, [m.home_score ?? 0, m.away_score ?? 0] as [number, number]]));
    const before = prev.current;
    prev.current = now;
    if (!before) return; // primera carga: no celebrar goles viejos
    for (const m of data.matches) {
      if (m.status !== "en_juego" && m.status !== "finalizado") continue;
      const b = before.get(m.id);
      if (!b) continue;
      const [h, a] = now.get(m.id)!;
      const scorer = h > b[0] ? m.home_team_id : a > b[1] ? m.away_team_id : null;
      if (!scorer) continue;
      const t = (id: string | null) => data.teams.find((x) => x.id === id);
      setGoal({ key: `${m.id}-${h}-${a}`, match: m, team: t(scorer), home: t(m.home_team_id), away: t(m.away_team_id) });
      try { navigator.vibrate?.([80, 60, 160]); } catch { /* */ }
      break;
    }
  }, [data.matches, data.teams, ready]);

  if (!goal) return null;
  return <GoalCelebration key={goal.key} goal={goal} onClose={() => setGoal(null)} />;
}
