import type { EventType } from "@/lib/types";

const LABEL: Record<EventType, string> = { gol: "Gol", autogol: "Autogol", amarilla: "Tarjeta amarilla", roja: "Tarjeta roja" };

/** Íconos propios (SVG) para eventos: se ven igual en todos los teléfonos, a diferencia de los emojis. */
export function EventIcon({ type, className = "" }: { type: EventType; className?: string }) {
  if (type === "amarilla" || type === "roja") {
    return (
      <svg viewBox="0 0 12 16" className={`h-4 w-3 shrink-0 ${className}`} role="img" aria-label={LABEL[type]}>
        <rect x="1" y="1" width="10" height="14" rx="1.5" fill={type === "amarilla" ? "#facc15" : "#dc2626"} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`} role="img" aria-label={LABEL[type]}>
      <circle cx="8" cy="8" r="7" fill="#fff" stroke={type === "autogol" ? "#dc2626" : "currentColor"} strokeWidth="1.2" />
      <path d="M8 4.6 10.9 6.7 9.8 10.1H6.2L5.1 6.7Z" fill={type === "autogol" ? "#dc2626" : "currentColor"} />
      <path d="M8 4.6V1.4M10.9 6.7l3-1M9.8 10.1l1.9 2.7M6.2 10.1l-1.9 2.7M5.1 6.7l-3-1" stroke={type === "autogol" ? "#dc2626" : "currentColor"} strokeWidth="1" />
    </svg>
  );
}
