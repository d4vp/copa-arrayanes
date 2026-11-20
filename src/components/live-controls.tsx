"use client";

import { Play, Undo2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/data/store";
import type { Match, Team } from "@/lib/types";
import { Crest } from "./crest";
import { SoccerBall } from "./sports";
import { useToast } from "./toast";

/**
 * Marcador en vivo para el organizador: iniciar partido y sumar goles con un toque.
 * Cada cambio llega por tiempo real a todos los celulares (celebración de gol).
 * El resultado final y la planilla se completan después con "Terminar".
 */
export function LiveControls({ match: m, home, away, onFinish }: { match: Match; home?: Team; away?: Team; onFinish: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<"home" | "away">>([]);

  const run = async (patch: Partial<Match>, label: string) => {
    setBusy(true);
    try {
      const r = await store.update("matches", { id: m.id }, patch, label);
      if (r === "en_cola") toast.saved(r, label);
    } catch (e) { toast.error(e, label); } finally { setBusy(false); }
  };

  if (m.status === "programado" || m.status === "aplazado") {
    return (
      <button disabled={busy} onClick={() => run({ status: "en_juego", home_score: 0, away_score: 0 }, "Partido iniciado")}
        className="btn w-full bg-[var(--live)] text-white hover:opacity-90">
        <Play className="size-4" />Iniciar partido en vivo
      </button>
    );
  }
  if (m.status !== "en_juego") return null;

  const goal = (side: "home" | "away") => {
    setHistory((h) => [...h, side]);
    return run(side === "home" ? { home_score: (m.home_score ?? 0) + 1 } : { away_score: (m.away_score ?? 0) + 1 }, "Gol");
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    return run(last === "home" ? { home_score: Math.max(0, (m.home_score ?? 0) - 1) } : { away_score: Math.max(0, (m.away_score ?? 0) - 1) }, "Corregir gol");
  };

  return (
    <section className="card space-y-3 border-rose-400/50 p-4" aria-label="Marcador en vivo">
      <p className="flex items-center gap-2 text-sm font-bold text-[var(--live)]"><span className="live-dot size-2 rounded-full bg-current" />EN VIVO · todos lo ven al instante</p>
      <div className="grid grid-cols-2 gap-3">
        {([["home", home, m.home_score], ["away", away, m.away_score]] as const).map(([side, t, score]) => (
          <button key={side} disabled={busy} onClick={() => goal(side)} aria-label={`Gol de ${t?.name}`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-transform active:scale-95 disabled:opacity-60">
            <Crest team={t} size={36} />
            <span className="w-full truncate text-center text-sm font-semibold">{t?.name}</span>
            <span className="font-display tabular text-4xl font-extrabold">{score ?? 0}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1 text-sm font-bold text-white dark:text-[#0b1220]"><SoccerBall className="size-4" />+ Gol</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost" disabled={busy || history.length === 0} onClick={undo}><Undo2 className="size-4" />Deshacer gol</button>
        <button className="btn btn-outline ml-auto" disabled={busy} onClick={onFinish}>Terminar y completar planilla</button>
      </div>
    </section>
  );
}
