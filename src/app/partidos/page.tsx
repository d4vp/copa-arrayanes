"use client";

import { CalendarClock, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { MatchCard } from "@/components/match-card";
import { CategoryPicker, usePublic } from "@/components/public-hooks";
import { EmptyState, ListSkeleton, PageHeader, Segmented } from "@/components/ui";
import { byDate, involvesFavorites } from "@/lib/data/selectors";
import { useFavorites } from "@/lib/favorites";
import { dayKey, relativeDay, fmtDate } from "@/lib/format";

type View = "proximos" | "resultados";

function Partidos() {
  const params = useSearchParams();
  const { data, ready, teams, categories } = usePublic();
  const { fav } = useFavorites();
  const [view, setView] = useState<View>(params.get("ver") === "resultados" ? "resultados" : "proximos");
  const [cat, setCat] = useState("todas");
  const [onlyFav, setOnlyFav] = useState(false);
  const hasFav = fav.teams.length + fav.veredas.length > 0;

  const days = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    let ms = data.matches.filter((m) => ids.has(m.category_id) && (cat === "todas" || m.category_id === cat));
    ms = view === "resultados"
      ? ms.filter((m) => m.status === "finalizado").sort((a, b) => byDate(b, a))
      : ms.filter((m) => m.status !== "finalizado").sort(byDate);
    if (onlyFav) ms = ms.filter((m) => involvesFavorites(m, teams, fav.teams, fav.veredas));
    const groups = new Map<string, typeof ms>();
    for (const m of ms) groups.set(dayKey(m.scheduled_at), [...(groups.get(dayKey(m.scheduled_at)) ?? []), m]);
    return [...groups.entries()];
  }, [data.matches, categories, cat, view, onlyFav, teams, fav]);

  return (
    <div className="space-y-4">
      <PageHeader title="Partidos" />
      <Segmented label="Ver" value={view} onChange={setView}
        options={[{ value: "proximos", label: "Próximos" }, { value: "resultados", label: "Resultados" }]} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1"><CategoryPicker categories={categories} value={cat} onChange={setCat} allowAll /></div>
        {hasFav && (
          <button className="chip" aria-pressed={onlyFav} onClick={() => setOnlyFav((x) => !x)}>
            <Star className={`size-4 ${onlyFav ? "fill-current" : ""}`} aria-hidden />Mis favoritos
          </button>
        )}
      </div>

      {!ready ? <ListSkeleton /> : days.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-8" />}
          title={view === "proximos" ? "No hay partidos por jugar" : "Todavía no hay resultados"}
          text={onlyFav ? "Prueba quitando el filtro de favoritos." : undefined} />
      ) : (
        <div className="space-y-5">
          {days.map(([key, ms]) => (
            <section key={key} className="fade-up">
              <h2 className="sticky top-14 z-10 -mx-4 bg-[var(--bg)]/95 px-4 py-1.5 text-sm font-bold capitalize backdrop-blur">
                {key === "sin-fecha" ? "Sin fecha asignada" : `${relativeDay(ms[0].scheduled_at)}${["Hoy", "Mañana", "Ayer"].includes(relativeDay(ms[0].scheduled_at)) ? ` · ${fmtDate(ms[0].scheduled_at)}` : ""}`}
              </h2>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {ms.map((m) => <MatchCard key={m.id} match={m} teams={teams} category={categories.find((c) => c.id === m.category_id)}
                  highlight={involvesFavorites(m, teams, fav.teams, fav.veredas)} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton />}><Partidos /></Suspense>;
}
