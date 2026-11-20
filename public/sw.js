/* Copa Arrayanes · Service Worker
 * - Funciona sin conexión: guarda páginas y recursos visitados.
 * - Recibe notificaciones push (resultados, recordatorios).
 * Los datos del campeonato se guardan aparte (IndexedDB) desde la app.
 */
const VERSION = "copa-v1";
const SHELL = ["/", "/partidos", "/tabla", "/equipos", "/mas", "/partido", "/equipo", "/estadisticas", "/historial", "/favoritos", "/manifest.webmanifest", "/icons/icon-192.png", "/brand/logo-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase y otros: sin interceptar

  // Recursos con hash (inmutables): primero caché
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Páginas: primero red (datos frescos); si no hay señal, la copia guardada
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html") || url.pathname.endsWith(".txt")) {
    const key = url.pathname; // ignora ?id=... : la página es la misma
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
        return res;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match(key)) || (await cache.match("/")) || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
  }
});

// ---------- Notificaciones ----------
self.addEventListener("push", (event) => {
  let data = { title: "Copa Arrayanes", body: "", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch { if (event.data) data.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    data: { url: data.url },
    tag: data.tag || undefined,
    lang: "es-CO",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if ("focus" in c) { await c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
