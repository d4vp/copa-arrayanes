import type { CrestShape, Team } from "@/lib/types";

const SHAPES: Record<CrestShape, string> = {
  escudo: "M24 2 44 8v16c0 13-8.5 21.5-20 26C12.5 45.5 4 37 4 24V8Z",
  circulo: "M24 3a22 22 0 1 1 0 44 22 22 0 0 1 0-44Z",
  hexagono: "M24 2 44 13.5v23L24 48 4 36.5v-23Z",
  diamante: "M24 2 46 25 24 48 2 25Z",
};

export function initials(name: string, short?: string | null) {
  if (short) return short.toUpperCase().slice(0, 3);
  const words = name.replace(/^(Las|Los|El|La)\s+/i, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((w) => w[0]).join("") : words[0]?.slice(0, 3) ?? "?").toUpperCase().slice(0, 3);
}

/** Escudo personalizable: forma + colores + iniciales, o foto subida. */
export function Crest({
  team, size = 40, className = "",
}: { team: Pick<Team, "name" | "short_name" | "crest_shape" | "color_primary" | "color_secondary" | "crest_url"> | undefined | null; size?: number; className?: string }) {
  if (!team) {
    return <span className={`inline-block shrink-0 rounded-full border border-dashed border-[var(--border)] ${className}`} style={{ width: size, height: size }} aria-label="Por definir" />;
  }
  if (team.crest_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.crest_url} alt={`Escudo de ${team.name}`} width={size} height={size} loading="lazy"
      className={`shrink-0 rounded-lg object-contain ${className}`} style={{ width: size, height: size }} />;
  }
  const text = initials(team.name, team.short_name);
  const light = isLight(team.color_primary);
  return (
    <svg viewBox="0 0 48 50" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label={`Escudo de ${team.name}`}>
      <path d={SHAPES[team.crest_shape] ?? SHAPES.escudo} fill={team.color_primary} stroke={light ? "#cbd5e1" : team.color_secondary} strokeWidth="2.5" />
      <text x="24" y="29.5" textAnchor="middle" fontFamily="var(--font-display), system-ui, sans-serif" fontWeight="800"
        fontSize={text.length > 2 ? 13 : 16} fill={team.color_secondary}>{text}</text>
    </svg>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}
