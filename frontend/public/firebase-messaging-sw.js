 
// ──────────────────────────────────────────────
//  Firebase Cloud Messaging Service Worker
//  Handles background push notifications when
//  the app tab is not in focus.
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
      setupBackgroundHandler();
    } catch (err) {
      console.warn("Firebase messaging init failed:", err);
    }
  }
});

function setupBackgroundHandler() {
  if (!messagingInstance) return;

  // Handle background messages (when tab is not focused)
  messagingInstance.onBackgroundMessage((payload) => {
    const notification = payload.notification ?? {};
    const data = payload.data ?? {};

    const notificationTitle = notification.title ?? "OMG Teams";
    const notificationOptions = {
      body: notification.body ?? "You have a new notification",
      icon: notification.icon ?? "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag: data.tag ?? "omg-notification",
      data: {
        url: notification.click_action ?? data.url ?? "/notifications",
      },
    };

    self.registration.showNotification(notificationTitle, notificationOptions);

    // Notify any open app tabs so they can re-sync unread count
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "FCM_BACKGROUND_RECEIVED" });
      }
    });
  });
}

// Handle notification click — open the app at the right URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    }),
  );
});
