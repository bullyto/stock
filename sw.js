/* sw.js — béton / anti lenteurs / anti blocage */
"use strict";

/**
 * ✅ OBJECTIF
 * - L’app doit s’afficher INSTANT : on sert l’App Shell depuis le cache en priorité (stale-while-revalidate).
 * - Les assets (js/css) : cache-first + update en fond.
 * - Les images locales : cache-first.
 * - Ne JAMAIS toucher aux appels GitHub API / raw.
 * - Timeout réseau pour éviter les requêtes qui pendent (la “minute”).
 */

const VERSION = "v2026-01-03_01"; // <-- bump quand tu veux forcer une MAJ (optionnel si tu changes les fichiers)
const CACHE_APP   = `app-${VERSION}`;      // app shell (html + manifest + sw)
const CACHE_ASSET = `asset-${VERSION}`;    // js/css/fonts locaux
const CACHE_IMG   = `img-${VERSION}`;      // images locales
const CACHE_RT    = `rt-${VERSION}`;       // runtime (autres GET same-origin)

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  // Si tu as des icônes locales, ajoute-les ici :
  // "./icons/icon-192.png",
  // "./icons/icon-512.png",
];

const SAME_ORIGIN = self.location.origin;

// -----------------------
// Helpers
// -----------------------
function isSameOrigin(url) {
  return url.origin === SAME_ORIGIN;
}

function isHTMLRequest(req, url) {
  const accept = (req.headers.get("accept") || "");
  return (
    req.mode === "navigate" ||
    accept.includes("text/html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html")
  );
}

function isAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|eot)$/i.test(url.pathname);
}

function isImage(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname);
}

function shouldBypass(url) {
  // ⚠️ Ne pas intercepter GitHub API / raw (ton app en dépend)
  const h = url.hostname;
  return (
    h.includes("github.com") ||
    h.includes("githubusercontent.com") ||
    h.includes("api.github.com")
  );
}

function withTimeout(promise, ms, onTimeoutValue = null) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(onTimeoutValue), ms);
    }),
  ]);
}

async function safePut(cacheName, req, res) {
  try {
    if (!res || !res.ok) return;
    const cache = await caches.open(cacheName);
    await cache.put(req, res.clone());
  } catch {}
}

async function cleanupOldCaches() {
  const keep = new Set([CACHE_APP, CACHE_ASSET, CACHE_IMG, CACHE_RT]);
  const keys = await caches.keys();
  await Promise.all(keys.map(k => keep.has(k) ? null : caches.delete(k)));
}

// Petit nettoyage soft du runtime pour éviter qu’il grossisse à l’infini
async function trimCache(cacheName, maxEntries = 120) {
  try {
    const cache
