import admin from "firebase-admin";
import { env } from "./env.js";
import { logger } from "../instrument.js";
import { registerService } from "./service-init.js";

// ──────────────────────────────────────────────
//  Firebase Admin SDK (Server-Side)
//
//  Used for:
//  - Realtime Database writes (presence)
//  - Firestore queries (last active)
//  - Security rule enforcement
// ──────────────────────────────────────────────

let firebaseApp: admin.app.App | undefined;

export function getFirebaseAdmin(): admin.app.App {
  if (!firebaseApp) {
    const credential = env.FIREBASE_SERVICE_ACCOUNT
      ? admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount)
      : admin.credential.applicationDefault();

    const opts: admin.AppOptions = { credential };
    if (env.FIREBASE_DATABASE_URL) opts.databaseURL = env.FIREBASE_DATABASE_URL;
    if (env.GOOGLE_CLOUD_PROJECT_ID) opts.projectId = env.GOOGLE_CLOUD_PROJECT_ID;
    firebaseApp = admin.initializeApp(opts);
  }
  return firebaseApp;
}

export function getFirebaseDb(): admin.database.Database {
  return getFirebaseAdmin().database();
}

export function getFirebaseFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

registerService({
  name: "firebase",
  critical: false,
  isConfigured: () => env.hasFirebase,

  // eslint-disable-next-line @typescript-eslint/require-await
  async connect() {
    getFirebaseAdmin();
    logger.info("Firebase Admin initialized", {
      projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    });
  },

  async disconnect() {
    if (firebaseApp) {
      await firebaseApp.delete();
      firebaseApp = undefined;
    }
  },
});
