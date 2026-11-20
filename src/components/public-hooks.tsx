"use client";

import { useEffect, useMemo, useState } from "react";
import { categoriesOf, currentEdition, teamMap } from "@/lib/data/selectors";
import { useStore } from "@/lib/data/store";
import { BRANCH_LABEL } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Segmented } from "./ui";

/** Datos públicos más usados por las páginas. */
export function usePublic(editionId?: string | null) {
  const { data, ready, status, refresh } = useStore();
  return useMemo(() => {
    const edition = editionId ? data.editions.find((e) => e.id === editionId) ?? null : currentEdition(data);
    return {
      data, ready, status, refresh, edition,
      teams: teamMap(data),
      categories: categoriesOf(data, edition?.id),
      category: (id: string) => data.categories.find((c) => c.id === id),
    };
  }, [data, ready, status, refresh, editionId]);
}

/** Categoría elegida, recordada entre páginas (reconocer antes que recordar). */
export function useCategoryChoice(categories: Category[]) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!categories.length) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem("copa-categoria"); } catch { /* */ }
    setId((cur) => (cur && categories.some((c) => c.id === cur) ? cur : categories.find((c) => c.id === saved)?.id ?? categories[0].id));
  }, [categories]);
  const choose = (v: string) => { setId(v); try { localStorage.setItem("copa-categoria", v); } catch { /* */ } };
  return [categories.find((c) => c.id === id) ?? null, choose] as const;
}

export function CategoryPicker({ categories, value, onChange, allowAll = false }: {
  categories: Category[]; value: string; onChange: (v: string) => void; allowAll?: boolean;
}) {
  if (categories.length <= 1 && !allowAll) return null;
  const opts = categories.map((c) => ({ value: c.id, label: categoryShort(c, categories) }));
  return (
    <Segmented label="Categoría" value={value} onChange={onChange}
      options={allowAll ? [{ value: "todas", label: "Todas" }, ...opts] : opts} />
  );
}

/** Nombre corto: si todas son del mismo deporte basta con la rama. */
export function categoryShort(c: Category, all: Category[]) {
  const sameSport = all.every((x) => x.sport_id === c.sport_id);
  const sameBranchCount = all.filter((x) => x.branch === c.branch && x.sport_id === c.sport_id).length;
  return sameSport && sameBranchCount === 1 ? BRANCH_LABEL[c.branch] : c.name;
}
