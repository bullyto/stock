/* sw.js - offline app shell + runtime cache images */
const CACHE_NAME = "stock-vehicule-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || new Response("Offline", { status: 200 });
      }
    })());
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isImage = req.destination === "image" || /\.(png|jpg|jpeg|webp|svg)$/i.test(url.pathname);

  if (isSameOrigin && isImage) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        (await caches.open(CACHE_NAME)).put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || new Response("", { status: 200 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      (await caches.open(CACHE_NAME)).put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || new Response("", { status: 200 });
    }
  })());
});
