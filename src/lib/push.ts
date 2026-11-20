"use client";

import { getBackend } from "./data/store";
import { appError, toAppError } from "./errors";
import { getFavorites } from "./favorites";

/** Notificaciones push sin cuenta (Web Push, gratuito). */
export type PushState = "no_soportado" | "bloqueado" | "inactivo" | "activo" | "sin_configurar";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "no_soportado";
  if (Notification.permission === "denied") return "bloqueado";
  if (getBackend().mode === "supabase" && !VAPID) return "sin_configurar";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "activo" : "inactivo";
}

async function send(sub: PushSubscription, notifyAll: boolean) {
  const json = sub.toJSON();
  const fav = getFavorites();
  await getBackend().rpc("save_push_subscription", {
    p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
    p_teams: fav.teams, p_veredas: fav.veredas, p_all: notifyAll,
  });
}

export async function enablePush(notifyAll = false) {
  if (!pushSupported()) throw appError("validacion", "Este navegador no admite notificaciones. En iPhone, primero instala la app en la pantalla de inicio.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw appError("no_autorizado", "Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.");
  if (getBackend().mode === "local") {
    // Demostración: confirma que funciona mostrando una notificación local.
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Copa Arrayanes", { body: "Así te avisaremos de partidos y resultados.", icon: "/icons/icon-192.png" });
    localStorage.setItem("copa-push-demo", notifyAll ? "todo" : "favoritos");
    return;
  }
  if (!VAPID) throw appError("servidor", "Las notificaciones aún no están configuradas en el servidor.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) }));
  try {
    await send(sub, notifyAll);
    localStorage.setItem("copa-push-todo", notifyAll ? "1" : "0");
  } catch (e) {
    throw toAppError(e);
  }
}

export async function disablePush() {
  localStorage.removeItem("copa-push-demo");
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  await getBackend().rpc("delete_push_subscription", { p_endpoint: json.endpoint, p_auth: json.keys?.auth }).catch(() => {});
  await sub.unsubscribe();
}

/** Llamar cuando cambian los favoritos: actualiza qué avisos recibe. */
export async function syncPushFavorites() {
  if (!pushSupported() || getBackend().mode !== "supabase") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await send(sub, localStorage.getItem("copa-push-todo") === "1").catch(() => { /* se reintenta al próximo cambio */ });
}
