import { z } from "zod";
import { logger } from "../instrument.js";
import * as pushSvc from "../services/push.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Push Subscription Controller
//  Register/unregister FCM tokens and Web Push
//  subscriptions for the authenticated user.
// ──────────────────────────────────────────────

const registerSchema = z
  .object({
    endpoint: z.string().min(1),
    type: z.enum(["FCM", "WEB_PUSH"]).optional().default("FCM"),
    deviceId: z.string().optional(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .optional(),
  })
  .refine((data) => data.type !== "WEB_PUSH" || data.keys !== undefined, {
    message: "Web Push subscriptions require keys (p256dh + auth)",
    path: ["keys"],
  });

const unregisterSchema = z.object({
  endpoint: z.string().min(1),
});

/** POST /api/v1/push-subscriptions — Register a push token */
export async function handleRegisterToken(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = registerSchema.parse(req.body);

  const subscription = await pushSvc.registerToken({
    userId,
    endpoint: body.endpoint,
    type: body.type,
    ...(body.deviceId ? { deviceId: body.deviceId } : {}),
    ...(req.headers["user-agent"] ? { userAgent: req.headers["user-agent"] } : {}),
    keys: body.type === "WEB_PUSH" ? (body.keys ?? null) : null,
  });

  logger.info("Push subscription registered", { userId, type: body.type, id: subscription.id });
  res.status(201).json({ id: subscription.id, message: "Push subscription registered" });
}

/** DELETE /api/v1/push-subscriptions — Unregister a push token */
export async function handleUnregisterToken(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { endpoint } = unregisterSchema.parse(req.body);

  const removed = await pushSvc.unregisterToken(userId, endpoint);

  if (removed) {
    logger.info("Push subscription removed", { userId });
    res.status(200).json({ message: "Push subscription removed" });
  } else {
    res.status(404).json({ error: "Subscription not found" });
  }
}
