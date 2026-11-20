"use client";

import Link from "next/link";
import { BarChart3, Shield } from "lucide-react";
import { useMemo } from "react";
import { Crest } from "@/components/crest";
import { CategoryPicker, useCategoryChoice, usePublic } from "@/components/public-hooks";
import { EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { categoryView } from "@/lib/data/selectors";

export default function EstadisticasPage() {
  const { data, ready, teams, categories } = usePublic();
  const [cat, setCat] = useCategoryChoice(categories);
  const view = useMemo(() => (cat ? categoryView(data, cat) : null), [data, cat]);
  const players = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data.players]);

  if (!ready) return <ListSkeleton rows={6} />;
  if (!cat || !view) return <EmptyState icon={<BarChart3 className="size-8" />} title="Aún no hay estadísticas" />;

  const maxGoals = view.scorers[0]?.goals ?? 1;
  const played = view.matches.filter((m) => m.status === "finalizado");
  const goals = played.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);
  const fairPlay = [...view.table].sort((a, b) => a.fairPlay - b.fairPlay).slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader title="Estadísticas" />
      <CategoryPicker categories={categories} value={cat.id} onChange={setCat} />

      <div className="grid grid-cols-3 gap-2">
        {[["Partidos jugados", played.length], ["Goles", goals], ["Promedio por partido", played.length ? (goals / played.length).toFixed(1) : "–"]].map(([l, v]) => (
          <div key={l} className="card p-3 text-center">
            <p className="font-display tabular text-2xl font-extrabold">{v}</p>
            <p className="text-xs text-[var(--muted)]">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Goleadores">
          {view.scorers.length === 0 ? <EmptyState title="Sin goles registrados por jugador" text="Aparecen cuando se registra la planilla del partido." /> : (
            <ol className="card divide-y divide-[var(--border)]">
              {view.scorers.map((s, i) => {
                const p = players.get(s.playerId);
                const t = teams.get(s.teamId);
                return (
                  <li key={s.playerId} className="flex items-center gap-3 p-3">
                    <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-400 text-amber-950" : "bg-[var(--surface-2)]"}`}>{i + 1}</span>
                    <Crest team={t} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p?.full_name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]" aria-hidden>
                        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(s.goals / maxGoals) * 100}%` }} />
                      </div>
                    </div>
                    <span className="font-display tabular text-xl font-extrabold">{s.goals}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section title="Valla menos vencida">
          {view.defense.length === 0 ? <EmptyState icon={<Shield className="size-8" />} title="Faltan partidos" text="Se calcula con al menos 2 partidos jugados por equipo." /> : (
            <ol className="card divide-y divide-[var(--border)]">
              {view.defense.slice(0, 6).map((d, i) => {
                const t = teams.get(d.teamId);
                return (
                  <li key={d.teamId} className="flex items-center gap-3 p-3">
                    <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)]"}`}>{i + 1}</span>
                    <Crest team={t} size={28} />
                    <Link href={`/equipo?id=${d.teamId}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{t?.name}</Link>
                    <span className="text-right text-sm"><b className="tabular">{d.against}</b> <span className="text-[var(--muted)]">en {d.played} PJ</span></span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-2 px-1 text-xs text-[var(--muted)]">Ordenado por promedio de goles recibidos por partido.</p>
        </Section>

        <Section title="Juego limpio">
          <ol className="card divide-y divide-[var(--border)]">
            {fairPlay.map((r) => (
              <li key={r.teamId} className="flex items-center gap-3 p-3">
                <Crest team={teams.get(r.teamId)} size={28} />
                <span className="flex-1 truncate font-semibold">{teams.get(r.teamId)?.name}</span>
                <span className="text-sm text-[var(--muted)]"><b className="tabular text-[var(--text)]">{r.fairPlay}</b> pts</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 px-1 text-xs text-[var(--muted)]">Amarilla = 1 punto, roja = 3. Menos es mejor.</p>
        </Section>
      </div>
    </div>
  );
}
