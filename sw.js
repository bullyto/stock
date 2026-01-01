/* sw.js - offline app shell */
const CACHE_NAME = "stock-vehicule-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg",
  "./images/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      "./",
      "./index.html",
      "./manifest.webmanifest",
      "./icon-192.svg",
      "./icon-512.svg"
    ]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // App shell for navigations
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match("./index.html");
          return cached || new Response("Offline", { status: 200 });
        }
      })()
    );
    return;
  }

  // Cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        // Optionally cache same-origin assets (including images)
        try{
          const url = new URL(req.url);
          if (url.origin === self.location.origin) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
          }
        }catch(e){}
        return fresh;
      } catch (e) {
        return cached || new Response("", { status: 200 });
      }
    })()
  );
});
