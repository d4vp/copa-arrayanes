import Link from "next/link";
import type { Team } from "@/lib/types";
import { Crest } from "./crest";

const PLACES = [
  { label: "Campeón", medal: "bg-amber-400 text-amber-950", h: "h-24" },
  { label: "Subcampeón", medal: "bg-slate-300 text-slate-800", h: "h-16" },
  { label: "Tercero", medal: "bg-orange-400 text-orange-950", h: "h-12" },
  { label: "Cuarto", medal: "bg-[var(--surface-2)] text-[var(--muted)]", h: "h-8" },
];

/** Podio 1°–4°. Orden visual 2-1-3 y el cuarto aparte. */
export function Podium({ podium, teams }: { podium: Array<string | null>; teams: Map<string, Team> }) {
  const col = (i: number) => {
    const t = podium[i] ? teams.get(podium[i]!) : undefined;
    const p = PLACES[i];
    return (
      <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5 text-center">
        <Crest team={t} size={i === 0 ? 56 : 44} />
        {t ? <Link href={`/equipo?id=${t.id}`} className="line-clamp-2 text-sm font-bold hover:underline">{t.name}</Link> : <span className="text-sm text-[var(--muted)]">Por definir</span>}
        <div className={`w-full rounded-t-lg ${p.medal} ${p.h} grid place-items-start justify-center pt-1.5`}>
          <span className="font-display text-xl font-extrabold">{i + 1}°</span>
        </div>
      </div>
    );
  };
  const fourth = podium[3] ? teams.get(podium[3]!) : undefined;
  return (
    <div className="card p-4">
      <div className="flex items-end gap-2">{[1, 0, 2].map(col)}</div>
      {fourth && (
        <p className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-sm">
          <span className="font-display font-bold text-[var(--muted)]">4°</span><Crest team={fourth} size={22} />{fourth.name}
        </p>
      )}
    </div>
  );
}
