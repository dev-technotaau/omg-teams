import { type PushType, Prisma } from "@prisma/client";
import webpush from "web-push";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { registerService } from "../config/service-init.js";
import { logger } from "../instrument.js";
import type admin from "firebase-admin";

// ──────────────────────────────────────────────
//  Push Notification Service
//
//  Supports two transports:
//  1. FCM (Firebase Cloud Messaging) — primary
//  2. Web Push (VAPID) — fallback / standalone
//
//  Tokens stored in PushSubscription model,
//  linked per-user per-device.
// ──────────────────────────────────────────────

// ── VAPID setup (Web Push) ──
if (env.hasVapid) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

// ── Service registration ──
registerService({
  name: "webpush-vapid",
  critical: false,
  isConfigured: () => env.hasVapid,
  connect: () => {
    if (!env.hasVapid) return;
    // VAPID is already configured above — just log confirmation
    logger.info("Web Push (VAPID) configured", { subject: env.VAPID_SUBJECT });
  },
  disconnect: () => {
    // Stateless — no cleanup needed
  },
});

// ── Firebase Messaging singleton ──
let messaging: admin.messaging.Messaging | undefined;

function getMessaging(): admin.messaging.Messaging | undefined {
  if (messaging) return messaging;
  if (!env.hasFirebase) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirebaseAdmin } = require("../config/firebase.js") as {
      getFirebaseAdmin: () => admin.app.App;
    };
    messaging = getFirebaseAdmin().messaging();
    return messaging;
  } catch {
    logger.warn("Firebase messaging not available");
    return undefined;
  }
}

// ──────────────────────────────────────────────
//  Token Registration
// ──────────────────────────────────────────────

export async function registerToken(data: {
  userId: string;
  endpoint: string;
  type: PushType;
  deviceId?: string;
  userAgent?: string;
  keys?: { p256dh: string; auth: string } | null;
}) {
  const prisma = getPrisma();
  const keysValue = data.keys ?? Prisma.JsonNull;

  return prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: data.userId, endpoint: data.endpoint } },
    update: {
      type: data.type,
      deviceId: data.deviceId ?? null,
      userAgent: data.userAgent ?? null,
      keys: keysValue,
    },
    create: {
      userId: data.userId,
      endpoint: data.endpoint,
      type: data.type,
      deviceId: data.deviceId ?? null,
      userAgent: data.userAgent ?? null,
      keys: keysValue,
    },
  });
}

export async function unregisterToken(userId: string, endpoint: string) {
  const prisma = getPrisma();

  const result = await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });

  return result.count > 0;
}

/** Remove all push subscriptions for a user (e.g., on account deletion) */
export async function unregisterAllTokens(userId: string) {
  const prisma = getPrisma();
  return prisma.pushSubscription.deleteMany({ where: { userId } });
}

// ──────────────────────────────────────────────
//  Push Delivery
// ──────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string | undefined;
  badge?: string | undefined;
  tag?: string | undefined;
  url?: string | undefined;
  data?: Record<string, string> | undefined;
}

/**
 * Send push notification to all registered devices for a user.
 * Tries FCM first, falls back to Web Push for WEB_PUSH-type subscriptions.
 * Auto-cleans stale/expired tokens.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const prisma = getPrisma();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return 0;

  let sent = 0;
  const staleIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      if (sub.type === "FCM") {
        await sendViaFCM(sub.endpoint, payload);
      } else {
        await sendViaWebPush(
          sub.endpoint,
          sub.keys as { p256dh: string; auth: string } | null,
          payload,
        );
      }
      sent++;
    } catch (err: unknown) {
      const isGone = isTokenExpiredError(err);
      if (isGone) {
        staleIds.push(sub.id);
        logger.info("Removing stale push subscription", { id: sub.id, userId });
      } else {
        logger.error("Push notification delivery failed", {
          subscriptionId: sub.id,
          userId,
          type: sub.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Clean up stale tokens
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return sent;
}

// ── FCM Transport ──

async function sendViaFCM(token: string, payload: PushPayload): Promise<void> {
  const fcm = getMessaging();
  if (!fcm) throw new Error("FCM not configured");

  const message: admin.messaging.Message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.icon ? { imageUrl: payload.icon } : {}),
    },
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? "/icons/icon-192x192.png",
        badge: payload.badge ?? "/icons/icon-96x96.png",
        tag: payload.tag ?? "omg-notification",
      },
      fcmOptions: {
        link: payload.url ?? "/notifications",
      },
    },
    data: {
      ...payload.data,
      url: payload.url ?? "/notifications",
      tag: payload.tag ?? "omg-notification",
    },
  };

  await fcm.send(message);
}

// ── Web Push Transport ──

async function sendViaWebPush(
  endpoint: string,
  keys: { p256dh: string; auth: string } | null,
  payload: PushPayload,
): Promise<void> {
  if (!env.hasVapid) throw new Error("VAPID keys not configured");
  if (!keys) throw new Error("Web Push subscription missing keys");

  const subscription: webpush.PushSubscription = {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  };

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icons/icon-192x192.png",
    badge: payload.badge ?? "/icons/icon-96x96.png",
    tag: payload.tag ?? "omg-notification",
    data: { url: payload.url ?? "/notifications", ...payload.data },
  });

  await webpush.sendNotification(subscription, jsonPayload, { TTL: 86400 });
}

// ── Error Classification ──

function isTokenExpiredError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // FCM: messaging/registration-token-not-registered
  if (msg.includes("not-registered") || msg.includes("not registered")) return true;
  // Web Push: 404 or 410 status
  if (msg.includes("410") || msg.includes("gone")) return true;
  if (
    "statusCode" in err &&
    ((err as { statusCode: number }).statusCode === 404 ||
      (err as { statusCode: number }).statusCode === 410)
  )
    return true;
  return false;
}
