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
// Note: we do NOT call self.skipWaiting() here — the new SW stays in the
// "waiting" state until the page explicitly asks it to take over (via the
// SKIP_WAITING message below). This prevents the "Update available" banner
// from racing and showing on every page load.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

// ── Activate: clean old caches + take over open tabs ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

// ── Message handler: allows the page to trigger skipWaiting on user action ──
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

// ── Push: native Web Push event handler ──
// Shows a system notification AND tells open pages to re-sync unread count.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = event.data ? { body: event.data.text() } : {};
  }

  const title = payload.title ?? "OMG Teams";
  const options = {
    body: payload.body ?? "You have a new notification",
    icon: payload.icon ?? "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag: payload.tag ?? "omg-notification",
    data: { url: payload.url ?? "/notifications" },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Notify any open tabs so they can update their in-app state
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "PUSH_RECEIVED" });
        }
      }),
    ]),
  );
});

// ── Notification click: focus/open the app at the target URL ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
