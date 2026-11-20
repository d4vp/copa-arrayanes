"use client";

import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Crest } from "@/components/crest";
import { EventIcon } from "@/components/event-icon";
import { MatchCard } from "@/components/match-card";
import { usePublic } from "@/components/public-hooks";
import { EmptyState, FavoriteButton, ListSkeleton, Section } from "@/components/ui";
import { byDate, categoryView } from "@/lib/data/selectors";

function Equipo() {
  const id = useSearchParams().get("id") ?? "";
  const { data, ready, teams, categories } = usePublic();
  const t = teams.get(id);

  const info = useMemo(() => {
    const catIds = new Set(categories.map((c) => c.id));
    const matches = data.matches.filter((m) => catIds.has(m.category_id) && (m.home_team_id === id || m.away_team_id === id)).sort(byDate);
    const myCats = categories.filter((c) => data.category_teams.some((ct) => ct.category_id === c.id && ct.team_id === id));
    const stats = myCats.map((c) => {
      const v = categoryView(data, c);
      const pos = v.table.findIndex((r) => r.teamId === id);
      return { cat: c, row: v.table[pos], pos: pos + 1 };
    });
    const titles = data.category_podium.filter((p) => p.team_id === id && p.position <= 2).map((p) => {
      const c = data.categories.find((x) => x.id === p.category_id);
      const e = data.editions.find((x) => x.id === c?.edition_id);
      return { ...p, label: `${e?.name ?? ""} · ${c?.name ?? ""}` };
    });
    const players = data.players.filter((p) => p.team_id === id && p.active).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
    const goals = new Map<string, number>();
    for (const e of data.match_events) if (e.type === "gol" && e.player_id && e.team_id === id) goals.set(e.player_id, (goals.get(e.player_id) ?? 0) + 1);
    return { matches, stats, titles, players, goals };
  }, [data, categories, id]);

  if (!ready) return <ListSkeleton rows={4} />;
  if (!t) return <EmptyState title="Equipo no encontrado" action={<Link href="/equipos" className="btn btn-primary">Ver equipos</Link>} />;
  const vereda = data.veredas.find((v) => v.id === t.vereda_id);
  const next = info.matches.filter((m) => m.status !== "finalizado");
  const done = info.matches.filter((m) => m.status === "finalizado").reverse();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/equipos" className="btn btn-ghost -ml-3 px-3"><ArrowLeft className="size-4" />Equipos</Link>
      <header className="card fade-up relative overflow-hidden p-5">
        <div aria-hidden className="absolute inset-y-0 right-0 w-1/3 opacity-15" style={{ background: `linear-gradient(90deg, transparent, ${t.color_primary})` }} />
        <div className="relative flex items-center gap-4">
          <Crest team={t} size={76} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold leading-tight">{t.name}</h1>
            {vereda && <p className="text-sm text-[var(--muted)]">Vereda {vereda.name}</p>}
          </div>
          <FavoriteButton kind="teams" id={t.id} label={t.name} />
        </div>
        {info.stats.map((s) => s.row && (
          <dl key={s.cat.id} className="relative mt-4 grid grid-cols-4 gap-2 text-center">
            {[["Posición", `${s.pos}°`], ["Puntos", s.row.points], ["Jugados", s.row.played], ["Goles", `${s.row.goalsFor}:${s.row.goalsAgainst}`]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[var(--surface-2)] p-2">
                <dd className="font-display tabular text-xl font-extrabold">{v}</dd>
                <dt className="text-[0.7rem] text-[var(--muted)]">{l}</dt>
              </div>
            ))}
          </dl>
        ))}
      </header>

      {info.titles.length > 0 && (
        <Section title="Palmarés">
          <ul className="card divide-y divide-[var(--border)]">
            {info.titles.map((x) => (
              <li key={x.category_id} className="flex items-center gap-3 p-3 text-sm">
                <Trophy className={`size-5 ${x.position === 1 ? "text-amber-500" : "text-slate-400"}`} aria-hidden />
                <span className="font-semibold">{x.position === 1 ? "Campeón" : "Subcampeón"}</span>
                <span className="text-[var(--muted)]">{x.label}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {next.length > 0 && <Section title="Próximos partidos"><div className="space-y-2">{next.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)}</div></Section>}
      {done.length > 0 && <Section title="Resultados"><div className="space-y-2">{done.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)}</div></Section>}

      <Section title={`Plantilla (${info.players.length})`}>
        {info.players.length === 0 ? <EmptyState title="Plantilla sin registrar" /> : (
          <ul className="card grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0">
            {info.players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3 sm:border-b sm:border-[var(--border)]">
                <span className="grid size-8 place-items-center rounded-lg font-display text-sm font-bold" style={{ background: t.color_primary, color: t.color_secondary }}>{p.number ?? "–"}</span>
                <span className="flex-1 truncate">{p.full_name}</span>
                {info.goals.get(p.id) ? <span className="flex items-center gap-1 text-sm text-[var(--muted)]"><EventIcon type="gol" />{info.goals.get(p.id)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<ListSkeleton rows={4} />}><Equipo /></Suspense>;
}
