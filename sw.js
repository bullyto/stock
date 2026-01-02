/* sw.js — update-safe (network-first for HTML, SWR for assets) */
const VERSION = "stock-vehicule-v5";
const CACHE_STATIC = `${VERSION}-static`;
const CACHE_PAGES  = `${VERSION}-pages`;

const CORE = ["./","./index.html","./manifest.webmanifest","./icon-192.svg","./icon-512.svg","./sw.js"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith("stock-vehicule-") && !k.startsWith(VERSION)) return caches.delete(k);
      return null;
    }));
    await self.clients.claim();
  })());
});

async function cachePut(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    await cachePut(CACHE_PAGES, request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("./index.html");
    return fallback || new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations => network-first
  const accept = (req.headers.get("accept") || "");
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // assets => stale-while-revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchP = fetch(req).then(async (fresh) => {
      if (fresh && fresh.ok) await cachePut(CACHE_STATIC, req, fresh.clone());
      return fresh;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(fetchP);
      return cached;
    }
    const fresh = await fetchP;
    return fresh || new Response("", { status: 504 });
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
