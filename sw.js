/* sw.js — Stock Véhicule (update-safe)
   - Network-first pour la navigation (index.html)
   - Stale-while-revalidate pour assets
   - SkipWaiting + ClientsClaim
*/
const VERSION = "stock-vehicule-v4"; // <-- incrémente à chaque gros déploiement si tu veux être 100% sûr
const CACHE_STATIC = `${VERSION}-static`;
const CACHE_PAGES  = `${VERSION}-pages`;

// Mets ici les fichiers “coeur” du site (si tu renommes, ajuste)
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg",
  "./sw.js",
];

// --- Install
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

// --- Activate
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith("stock-vehicule-") && !k.startsWith(VERSION)) {
        return caches.delete(k);
      }
      return null;
    }));
    await self.clients.claim();
  })());
});

// Helpers
async function cachePut(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    // On cache une copie
    await cachePut(CACHE_PAGES, request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // fallback index si navigation offline
    const fallback = await caches.match("./index.html");
    return fallback || new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(async (fresh) => {
    // évite de casser si response invalide
    if (fresh && fresh.ok) {
      await cachePut(CACHE_STATIC, request, fresh.clone());
    }
    return fresh;
  }).catch(() => null);

  // si on a cache => on renvoie direct, et on refresh en fond
  if (cached) {
    eventWait(fetchPromise);
    return cached;
  }
  // sinon on attend le réseau
  const fresh = await fetchPromise;
  return fresh || new Response("", { status: 504 });
}

// petite astuce: garder une promesse alive sans bloquer la réponse
function eventWait(promise) {
  try { self.registration && self.registration.active; } catch(e) {}
}

// --- Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On ne gère que GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignore les requêtes vers d’autres domaines (ex: api.github.com, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // NAVIGATION (page) => Network-first (pour ne jamais rester bloqué sur une vieille version)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Assets (js/css/svg/png/webmanifest) => stale-while-revalidate
  // (Très bon compromis : rapide + se met à jour)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchP = fetch(req).then(async (fresh) => {
      if (fresh && fresh.ok) await cachePut(CACHE_STATIC, req, fresh.clone());
      return fresh;
    }).catch(() => null);

    if (cached) {
      // update en fond
      fetchP && event.waitUntil(fetchP);
      return cached;
    }
    const fresh = await fetchP;
    return fresh || new Response("", { status: 504 });
  })());
});

// --- Message: allow “SKIP_WAITING”
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
