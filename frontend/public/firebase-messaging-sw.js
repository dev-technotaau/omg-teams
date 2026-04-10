// ──────────────────────────────────────────────
//  Firebase Cloud Messaging Service Worker
//  Handles background push notifications when
//  the app tab is not in focus.
//
//  IMPORTANT: push, notificationclick, and
//  pushsubscriptionchange handlers MUST be
//  registered during initial script evaluation
//  (not lazily after postMessage) or the browser
//  will warn and may miss events.
// ──────────────────────────────────────────────

importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js");

// Firebase config received from main app via postMessage
let messagingInstance = null;

// Listen for config from main app
self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && !messagingInstance) {
    try {
      firebase.initializeApp(event.data.config);
      messagingInstance = firebase.messaging();
      // Set up the FCM background message handler once messaging is ready
      messagingInstance.onBackgroundMessage((payload) => {
        // If our own push handler already showed a notification for this
        // payload, skip to avoid duplicates.
        handleBackgroundPayload(payload.notification, payload.data);
      });
    } catch (err) {
      console.warn("Firebase messaging init failed:", err);
    }
  }
});

// ── Shared notification logic ──
function handleBackgroundPayload(notification, data) {
  notification = notification ?? {};
  data = data ?? {};

  const title = notification.title ?? "OMG Teams";
  const options = {
    body: notification.body ?? "You have a new notification",
    icon: notification.icon ?? "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag: data.tag ?? "omg-notification",
    data: {
      url: notification.click_action ?? data.url ?? "/notifications",
    },
  };

  self.registration.showNotification(title, options);

  // Notify any open app tabs so they can re-sync unread count
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: "FCM_BACKGROUND_RECEIVED" });
    }
  });
}

// ── Event handlers — registered at initial evaluation ──

// Handle raw push events (covers both FCM and non-FCM push)
self.addEventListener("push", (event) => {
  // If Firebase messaging is initialized, it handles its own push events
  // via onBackgroundMessage — skip to avoid duplicate notifications.
  if (messagingInstance) return;

  // Fallback: if messaging isn't initialized yet (config not received),
  // show the notification directly from the push payload.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = event.data ? { body: event.data.text() } : {};
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "OMG Teams", {
      body: payload.body ?? "You have a new notification",
      icon: payload.icon ?? "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag: payload.tag ?? "omg-notification",
      data: { url: payload.url ?? "/notifications" },
    }),
  );
});

// Handle notification click — open the app at the right URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Required by some browsers to suppress the warning even if unused
self.addEventListener("pushsubscriptionchange", () => {
  // Re-subscribe logic would go here if needed
});
