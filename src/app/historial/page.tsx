"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { Podium } from "@/components/podium";
import { usePublic } from "@/components/public-hooks";
import { Badge, EmptyState, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { categoryView } from "@/lib/data/selectors";
import { EDITION_STATUS_LABEL } from "@/lib/format";

export default function HistorialPage() {
  const { data, ready, teams } = usePublic();
  const editions = useMemo(() => [...data.editions].sort((a, b) => b.year - a.year), [data.editions]);
  const [open, setOpen] = useState<string | null>(null);
  const sel = editions.find((e) => e.id === open) ?? editions.find((e) => e.status === "finalizado") ?? editions[0];

  const views = useMemo(() => sel ? data.categories.filter((c) => c.edition_id === sel.id).map((c) => categoryView(data, c)) : [], [data, sel]);

  if (!ready) return <ListSkeleton />;
  if (!editions.length) return <EmptyState icon={<History className="size-8" />} title="Sin ediciones registradas" />;

  return (
    <div className="space-y-5">
      <PageHeader title="Historial" subtitle="Campeones y podios de cada edición. Los resultados de ediciones terminadas no se modifican." />
      <div role="tablist" aria-label="Edición" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {editions.map((e) => <button key={e.id} role="tab" aria-selected={e.id === sel?.id} className="chip" onClick={() => setOpen(e.id)}>{e.year}</button>)}
      </div>
      {sel && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold">{sel.name}</h2>
            <Badge tone={sel.status === "finalizado" ? "neutral" : "accent"}>{EDITION_STATUS_LABEL[sel.status]}</Badge>
          </div>
          {views.length === 0 ? <EmptyState title="Esta edición no tiene categorías" /> : views.map((v) => {
            const played = v.matches.filter((m) => m.status === "finalizado");
            const goals = played.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);
            const top = v.scorers[0];
            const p = top && data.players.find((x) => x.id === top.playerId);
            return (
              <Section key={v.category.id} title={v.category.name}>
                <Podium podium={v.podium} teams={teams} />
                <p className="mt-2 px-1 text-sm text-[var(--muted)]">
                  {played.length} partidos · {goals} goles{p ? <> · Goleador: <b className="text-[var(--text)]">{p.full_name}</b> ({top.goals})</> : null}
                </p>
              </Section>
            );
          })}
          {sel.status !== "finalizado" && <Link href="/tabla" className="btn btn-outline">Ver tabla en vivo</Link>}
        </>
      )}
    </div>
  );
}
