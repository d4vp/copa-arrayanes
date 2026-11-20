"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Star, Trophy } from "lucide-react";
import { useMemo } from "react";
import { Crest } from "@/components/crest";
import { SoccerBall } from "@/components/sports";
import { MatchCard } from "@/components/match-card";
import { NoticeBanner } from "@/components/notices";
import { categoryShort, usePublic } from "@/components/public-hooks";
import { StandingsTable } from "@/components/standings";
import { Badge, EmptyState, ListSkeleton, Section } from "@/components/ui";
import { byDate, categoryView, involvesFavorites } from "@/lib/data/selectors";
import { useFavorites } from "@/lib/favorites";
import { EDITION_STATUS_LABEL, fmtDate } from "@/lib/format";

export default function HomePage() {
  const { data, ready, edition, teams, categories } = usePublic();
  const { fav } = useFavorites();
  const hasFav = fav.teams.length + fav.veredas.length > 0;

  const { live, upcoming, recent, favNext } = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    const ms = data.matches.filter((m) => ids.has(m.category_id));
    const live = ms.filter((m) => m.status === "en_juego");
    const upcoming = ms.filter((m) => m.status === "programado" && m.home_team_id && m.away_team_id && (m.scheduled_at ?? "") >= new Date(Date.now() - 3 * 3600e3).toISOString()).sort(byDate);
    const recent = ms.filter((m) => m.status === "finalizado").sort((a, b) => byDate(b, a));
    const favNext = upcoming.find((m) => involvesFavorites(m, teams, fav.teams, fav.veredas));
    return { live, upcoming: upcoming.slice(0, 4), recent: recent.slice(0, 4), favNext };
  }, [data.matches, categories, teams, fav]);

  const views = useMemo(() => categories.map((c) => categoryView(data, c)), [data, categories]);
  const catOf = (id: string) => categories.find((c) => c.id === id);

  if (!ready) return <div className="space-y-4"><ListSkeleton rows={5} /></div>;
  if (!edition) return <EmptyState icon={<Trophy className="size-8" />} title="Aún no hay campeonatos publicados" text="Cuando el comité cree la primera edición, aquí verás partidos y resultados." />;

  return (
    <div className="space-y-6">
      {/* Encabezado de la edición */}
      <section className="fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] p-5 text-white shadow-lg">
        <div aria-hidden className="absolute -right-10 -top-10 size-44 rounded-full border-[18px] border-white/5" />
        <div aria-hidden className="absolute bottom-0 left-0 h-1.5 w-full bg-[#22c55e]" />
        {/* líneas de cancha y balón rodando */}
        <svg aria-hidden viewBox="0 0 200 120" className="absolute -right-6 top-1/2 h-40 -translate-y-1/2 opacity-15">
          <g stroke="#fff" strokeWidth="2" fill="none"><circle cx="100" cy="60" r="34" /><line x1="100" y1="0" x2="100" y2="120" /><circle cx="100" cy="60" r="3" fill="#fff" /></g>
        </svg>
        <div aria-hidden className="roll-host absolute inset-x-0 bottom-1.5 h-5"><div className="hero-roll absolute bottom-0 left-0"><SoccerBall className="size-5" /></div></div>
        <Badge tone="accent">{EDITION_STATUS_LABEL[edition.status]}</Badge>
        <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{edition.name}</h1>
        <p className="mt-1 text-sm text-blue-100">
          {categories.length} categoría{categories.length !== 1 ? "s" : ""}
          {edition.start_date && ` · ${fmtDate(edition.start_date + "T12:00:00Z", { day: "numeric", month: "long" })}`}
          {edition.end_date && ` al ${fmtDate(edition.end_date + "T12:00:00Z", { day: "numeric", month: "long" })}`}
        </p>
      </section>

      <NoticeBanner notices={data.notices} />

      {live.length > 0 && (
        <Section title="En juego ahora">
          <div className="grid gap-3 md:grid-cols-2">{live.map((m) => <MatchCard key={m.id} match={m} teams={teams} category={catOf(m.category_id)} />)}</div>
        </Section>
      )}

      {favNext ? (
        <Section title="Tu próximo partido" action={<Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />}>
          <MatchCard match={favNext} teams={teams} category={catOf(favNext.category_id)} highlight />
        </Section>
      ) : !hasFav && (
        <Link href="/equipos" className="card fade-up flex items-center gap-3 p-3 hover:shadow-md">
          <span className="grid size-9 place-items-center rounded-full bg-amber-400/15"><Star className="size-5 text-amber-500" aria-hidden /></span>
          <span className="flex-1 text-sm"><b>Sigue a tu equipo o vereda.</b> Márcalo con la estrella y verás primero sus partidos.</span>
          <ArrowRight className="size-4 text-[var(--muted)]" aria-hidden />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Próximos partidos" action={<Link href="/partidos" className="text-sm font-semibold text-[var(--brand)]">Ver todos</Link>}>
          {upcoming.length ? (
            <div className="space-y-2">{upcoming.map((m) => <MatchCard key={m.id} match={m} teams={teams} category={catOf(m.category_id)} highlight={involvesFavorites(m, teams, fav.teams, fav.veredas)} />)}</div>
          ) : <EmptyState icon={<CalendarClock className="size-8" />} title="No hay partidos programados" text="El comité publicará la programación pronto." />}
        </Section>

        <Section title="Últimos resultados" action={<Link href="/partidos?ver=resultados" className="text-sm font-semibold text-[var(--brand)]">Ver todos</Link>}>
          {recent.length ? (
            <div className="space-y-2">{recent.map((m) => <MatchCard key={m.id} match={m} teams={teams} category={catOf(m.category_id)} />)}</div>
          ) : <EmptyState title="Todavía no hay resultados" />}
        </Section>
      </div>

      {/* Resumen por categoría: líder y goleador */}
      <Section title="Así va la copa" action={<Link href="/tabla" className="text-sm font-semibold text-[var(--brand)]">Tabla completa</Link>}>
        <div className="grid gap-3 md:grid-cols-2">
          {views.map((v) => {
            const top = v.table.slice(0, 3);
            const scorer = v.scorers[0];
            const p = scorer && data.players.find((x) => x.id === scorer.playerId);
            const champion = v.podium[0] ? teams.get(v.podium[0]) : null;
            return (
              <div key={v.category.id} className="space-y-2">
                <p className="text-sm font-semibold text-[var(--muted)]">{categoryShort(v.category, categories)}</p>
                {champion ? (
                  <div className="card flex items-center gap-3 p-4">
                    <Trophy className="size-7 text-amber-500" aria-hidden /><Crest team={champion} size={36} />
                    <div><p className="text-xs text-[var(--muted)]">Campeón</p><p className="font-display text-lg font-bold">{champion.name}</p></div>
                  </div>
                ) : <StandingsTable rows={top} teams={teams} favorites={fav.teams} />}
                {scorer && p && (
                  <p className="px-1 text-sm text-[var(--muted)]">Goleador: <b className="text-[var(--text)]">{p.full_name}</b> · {scorer.goals} gol{scorer.goals > 1 ? "es" : ""}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
