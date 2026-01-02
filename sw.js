/* sw.js — anti-problèmes de MAJ */
"use strict";

const VERSION = "v2026-01-02_01"; // <-- change ça à chaque release (ou laisse, mais mieux de bump)
const CACHE_STATIC = `static-${VERSION}`;

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js"
  // Ajoute ici tes icônes si tu en as (ex: "./icons/icon-192.png", ...)
];

// Install: pré-cache du minimum + prend la main vite
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll(CORE.map(u => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

// Activate: clean anciens caches + contrôle immédiat
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("static-") && k !== CACHE_STATIC) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

// Message: permet au client de forcer l’activation
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data === "SKIP_WAITING" || data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch strategies
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ne pas toucher aux requêtes GitHub API / raw
  if (url.hostname.includes("github.com") || url.hostname.includes("githubusercontent.com") || url.hostname.includes("api.github.com")) {
    return;
  }

  // Navigation / HTML => network-first (pour éviter l’ancien index)
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html");

  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_STATIC);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // Assets (css/js/png/webp/svg/woff2 etc.) => cache-first + update en fond
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_STATIC);
          cache.put(req, fresh.clone());
        } catch {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_STATIC);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
