// ──────────────────────────────────────────────
//  OMG Teams — Service Worker
//  Provides offline fallback and caches static assets.
//  Registered by the app in src/components/providers.tsx
// ──────────────────────────────────────────────

const CACHE_NAME = "omg-teams-v1";
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install
const PRECACHE_URLS = [OFFLINE_URL];

// ── Install: pre-cache offline page ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ── Fetch: network-first with offline fallback ──
self.addEventListener("fetch", (event) => {
  // Only handle navigation requests (page loads)
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => response || new Response("Offline")),
    ),
  );
});
