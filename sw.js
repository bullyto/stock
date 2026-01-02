/* Stock Véhicule PWA - Service Worker (update-safe) */
const VERSION = "stock-vehicule-v6";
const CACHE_CORE = VERSION + "-core";
const CACHE_RUNTIME = VERSION + "-runtime";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icon-192.svg",
  "./icon-512.svg"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_CORE);
    await cache.addAll(CORE_ASSETS.map(u => new Request(u, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_CORE && k !== CACHE_RUNTIME) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, cacheName){
  const cache = await caches.open(cacheName);
  try{
    const res = await fetch(request, { cache: "no-store" });
    if(res && res.ok) cache.put(request, res.clone());
    return res;
  }catch{
    const cached = await cache.match(request);
    if(cached) return cached;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request, cacheName){
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(res => {
    if(res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);

  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin
  if(url.origin !== self.location.origin) return;

  // Always take latest for HTML/navigation
  if(req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")){
    event.respondWith(networkFirst(req, CACHE_CORE));
    return;
  }

  // Stock files: network-first (real-time) with cache fallback
  if(url.pathname.includes("/stock/") && url.pathname.endsWith(".json")){
    event.respondWith(networkFirst(req, CACHE_RUNTIME));
    return;
  }

  // Default: SWR for assets (images, icons, css, etc.)
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
});
