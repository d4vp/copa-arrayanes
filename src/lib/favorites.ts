"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Favoritos sin cuenta: se guardan en este dispositivo.
 * Si el visitante activó notificaciones, se sincronizan con su suscripción push.
 */
export interface Favorites { teams: string[]; veredas: string[] }

const KEY = "copa-favoritos";
const EMPTY: Favorites = { teams: [], veredas: [] };
const listeners = new Set<() => void>();
let cache: Favorites | null = null;

function read(): Favorites {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

function write(f: Favorites) {
  cache = f;
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* */ }
  listeners.forEach((l) => l());
}

export function getFavorites() { return read(); }

export function useFavorites() {
  const fav = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => EMPTY,
  );
  const toggle = useCallback((kind: keyof Favorites, id: string) => {
    const cur = read();
    const list = cur[kind].includes(id) ? cur[kind].filter((x) => x !== id) : [...cur[kind], id];
    write({ ...cur, [kind]: list });
    return list.includes(id);
  }, []);
  return { fav, toggle };
}

export function onFavoritesChange(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
