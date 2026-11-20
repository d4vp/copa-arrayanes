"use client";

import { useEffect } from "react";
import { onFavoritesChange } from "@/lib/favorites";
import { syncPushFavorites } from "@/lib/push";
import { useToast } from "./toast";

/** Registra el service worker y avisa cuando hay una versión nueva. */
export function ServiceWorker() {
  const toast = useToast();
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloading = false;
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            toast.show({ tone: "info", title: "Hay una versión nueva de la app", action: { label: "Actualizar", run: () => w.postMessage("SKIP_WAITING") } });
          }
        });
      });
    }).catch(() => { /* sin SW: la app sigue funcionando en línea */ });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) { reloading = true; window.location.reload(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onFavoritesChange(() => { void syncPushFavorites(); }), []);
  return null;
}
