import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  getMessaging as _getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";
import { env } from "./env";

// ──────────────────────────────────────────────
//  Firebase Client SDK (Singleton)
//
//  Used for:
//  - Realtime Database: online/offline presence
//  - Firestore: last active timestamps, presence queries
//  - Cloud Messaging: FCM push notifications
// ──────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
  measurementId: env.FIREBASE_MEASUREMENT_ID,
  databaseURL: env.FIREBASE_DATABASE_URL,
};

let app: FirebaseApp | undefined;
let db: Database | undefined;
let firestore: Firestore | undefined;
let messagingInstance: Messaging | undefined;
let swRegistration: ServiceWorkerRegistration | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getRealtimeDb(): Database {
  if (!db) {
    db = getDatabase(getApp());
  }
  return db;
}

export function getFirestoreDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getApp());
  }
  return firestore;
}

/**
 * Get the Firebase Messaging instance (singleton).
 * Returns null if not in browser or Firebase not configured.
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!env.hasFirebase) return null;
  if (!messagingInstance) {
    messagingInstance = _getMessaging(getApp());
  }
  return messagingInstance;
}

/**
 * Register the Firebase messaging service worker and pass config to it.
 * Call once on app mount (client-side only).
 * Returns the ServiceWorkerRegistration for use with getToken().
 */
export async function registerMessagingSW(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;
  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) return undefined;

  if (swRegistration) return swRegistration;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    swRegistration = registration;

    // Pass Firebase config to the SW via postMessage
    if (registration.active) {
      registration.active.postMessage({
        type: "FIREBASE_CONFIG",
        config: firebaseConfig,
      });
    }

    // Also set it on the SW global scope for initial load
    if (registration.installing) {
      registration.installing.addEventListener("statechange", function handler() {
        if (this.state === "activated") {
          this.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });
          this.removeEventListener("statechange", handler);
        }
      });
    }

    return registration;
  } catch (err) {
    console.warn("Firebase messaging SW registration failed:", err);
    return undefined;
  }
}

/**
 * Request FCM token from the browser.
 * Requires notification permission + service worker registration.
 * Returns null if not available or permission denied.
 */
export async function requestFCMToken(): Promise<string | null> {
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;

  const vapidKey = env.FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("FIREBASE_VAPID_KEY not configured — cannot get FCM token");
    return null;
  }

  const registration = await registerMessagingSW();
  if (!registration) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.warn("Failed to get FCM token:", err);
    return null;
  }
}

/**
 * Subscribe to foreground FCM messages.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: MessagePayload) => void,
): (() => void) | null {
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
}
