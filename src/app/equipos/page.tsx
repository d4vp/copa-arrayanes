"use client";

import Link from "next/link";
import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { usePublic } from "@/components/public-hooks";
import { EmptyState, FavoriteButton, ListSkeleton, PageHeader, Section } from "@/components/ui";
import { useFavorites } from "@/lib/favorites";

export default function EquiposPage() {
  const { data, ready, categories } = usePublic();
  const { fav } = useFavorites();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const catIds = new Set(categories.map((c) => c.id));
    const inEdition = new Set(data.category_teams.filter((ct) => catIds.has(ct.category_id)).map((ct) => ct.team_id));
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const veredaName = new Map(data.veredas.map((v) => [v.id, v.name]));
    const list = data.teams
      .filter((t) => inEdition.has(t.id) || inEdition.size === 0)
      .filter((t) => !q || norm(t.name).includes(norm(q)) || norm(veredaName.get(t.vereda_id ?? "") ?? "").includes(norm(q)));
    const byVereda = new Map<string, typeof list>();
    for (const t of list) {
      const k = t.vereda_id ?? "sin";
      byVereda.set(k, [...(byVereda.get(k) ?? []), t]);
    }
    return [...byVereda.entries()]
      .map(([id, teams]) => ({ id, name: veredaName.get(id) ?? "Sin vereda", teams: teams.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => Number(fav.veredas.includes(b.id)) - Number(fav.veredas.includes(a.id)) || a.name.localeCompare(b.name));
  }, [data, categories, q, fav.veredas]);

  return (
    <div className="space-y-4">
      <PageHeader title="Equipos" subtitle="Toca la estrella para seguir un equipo o una vereda." />
      <label className="relative block">
        <span className="sr-only">Buscar equipo o vereda</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input className="input pl-9" type="search" placeholder="Buscar equipo o vereda" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {!ready ? <ListSkeleton /> : groups.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title={q ? `Nada coincide con "${q}"` : "Aún no hay equipos inscritos"} />
      ) : groups.map((g) => (
        <Section key={g.id} title={`Vereda ${g.name}`} action={g.id !== "sin" && <FavoriteButton kind="veredas" id={g.id} label={`vereda ${g.name}`} size="sm" />}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.teams.map((t) => (
              <li key={t.id} className={`card flex items-center gap-3 p-2 pl-3 ${fav.teams.includes(t.id) ? "ring-2 ring-amber-400/50" : ""}`}>
                <Link href={`/equipo?id=${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Crest team={t} size={40} />
                  <span className="truncate font-semibold">{t.name}</span>
                </Link>
                <FavoriteButton kind="teams" id={t.id} label={t.name} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}
