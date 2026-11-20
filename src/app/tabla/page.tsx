"use client";

import { ListOrdered } from "lucide-react";
import { useMemo } from "react";
import { CategoryPicker, useCategoryChoice, usePublic } from "@/components/public-hooks";
import { Bracket, StandingsTable } from "@/components/standings";
import { Podium } from "@/components/podium";
import { EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { FORMATS } from "@/lib/domain/formats";
import { categoryView } from "@/lib/data/selectors";
import { useFavorites } from "@/lib/favorites";

export default function TablaPage() {
  const { data, ready, teams, categories } = usePublic();
  const [cat, setCat] = useCategoryChoice(categories);
  const { fav } = useFavorites();
  const view = useMemo(() => (cat ? categoryView(data, cat) : null), [data, cat]);

  if (!ready) return <ListSkeleton rows={6} />;
  if (!cat || !view) return <EmptyState icon={<ListOrdered className="size-8" />} title="Aún no hay tabla" text="Se mostrará cuando haya categorías y equipos inscritos." />;

  const perGroup = view.groups.length > 0 ? Math.floor(cat.knockout_size / view.groups.length) : 0;
  const hasPodium = view.podium.some(Boolean);

  return (
    <div className="space-y-5">
      <PageHeader title="Tabla de posiciones" subtitle={`${FORMATS[cat.format].label} · ${cat.points_win}-${cat.points_draw}-${cat.points_loss} puntos`} />
      <CategoryPicker categories={categories} value={cat.id} onChange={setCat} />

      {hasPodium && <Section title="Podio"><Podium podium={view.podium} teams={teams} /></Section>}

      {view.knockout.length > 0 && <Section title="Fase final"><Bracket matches={view.knockout} teams={teams} /></Section>}

      {view.groups.map((g) => (
        <Section key={g.label ?? "liga"} title={g.label ? `Grupo ${g.label}` : "Fase regular"}>
          {g.rows.length ? (
            <StandingsTable rows={g.rows} teams={teams} qualify={view.knockout.length ? 0 : perGroup} favorites={fav.teams} tiebreakers={cat.tiebreakers} />
          ) : <EmptyState title="Sin equipos inscritos" />}
        </Section>
      ))}
    </div>
  );
}
