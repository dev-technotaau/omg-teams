import { z } from "zod";
import * as svc from "../services/godview.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  §Godview — Controller handlers (admin-scoped)
//  All endpoints take :id (target user id) in the URL.
// ──────────────────────────────────────────────

function userIdOf(req: Request): string {
  return req.params["id"] as string;
}

function pagination(req: Request) {
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : undefined;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : undefined;
  return {
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

// ── 1. Login history ─────────────────────────────────────────────
export async function handleListLoginHistory(req: Request, res: Response): Promise<void> {
  const result = await svc.listLoginHistory(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 2. Notifications (admin view) ────────────────────────────────
export async function handleListUserNotifications(req: Request, res: Response): Promise<void> {
  const result = await svc.listUserNotifications(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 3. Auth methods ──────────────────────────────────────────────
export async function handleGetAuthMethods(req: Request, res: Response): Promise<void> {
  const result = await svc.getAuthMethods(userIdOf(req));
  res.status(200).json(result);
}

// ── 4. Leave balance history ─────────────────────────────────────
export async function handleListLeaveBalanceHistory(req: Request, res: Response): Promise<void> {
  const result = await svc.listLeaveBalanceHistory(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 5. Document history ──────────────────────────────────────────
export async function handleListDocumentHistory(req: Request, res: Response): Promise<void> {
  const result = await svc.listDocumentHistory(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 6. Presence ──────────────────────────────────────────────────
export async function handleGetUserPresence(req: Request, res: Response): Promise<void> {
  const result = await svc.getUserPresence(userIdOf(req));
  res.status(200).json(result);
}

// ── 7. Password history ──────────────────────────────────────────
export async function handleListPasswordHistory(req: Request, res: Response): Promise<void> {
  const result = await svc.listPasswordHistory(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 8. Webhook subscriptions (per-user CRUD) ─────────────────────
const webhookCreateSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8),
  events: z.array(z.string()).min(1),
  description: z.string().nullish(),
});

const webhookUpdateSchema = webhookCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function handleListWebhookSubscriptions(req: Request, res: Response): Promise<void> {
  const rows = await svc.listWebhookSubscriptions(userIdOf(req));
  res.status(200).json({ data: rows });
}

export async function handleCreateWebhookSubscription(req: Request, res: Response): Promise<void> {
  const parsed = webhookCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { url, secret, events, description } = parsed.data;
  const row = await svc.createWebhookSubscription(userIdOf(req), {
    url,
    secret,
    events,
    ...(description !== undefined ? { description } : {}),
  });
  res.status(201).json(row);
}

export async function handleUpdateWebhookSubscription(req: Request, res: Response): Promise<void> {
  const parsed = webhookUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const id = req.params["subscriptionId"] as string;
  const data: Parameters<typeof svc.updateWebhookSubscription>[1] = {};
  if (parsed.data.url !== undefined) data.url = parsed.data.url;
  if (parsed.data.secret !== undefined) data.secret = parsed.data.secret;
  if (parsed.data.events !== undefined) data.events = parsed.data.events;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  const row = await svc.updateWebhookSubscription(id, data);
  res.status(200).json(row);
}

export async function handleDeleteWebhookSubscription(req: Request, res: Response): Promise<void> {
  const id = req.params["subscriptionId"] as string;
  await svc.deleteWebhookSubscription(id);
  res.status(204).send();
}

// ── 9. Table preferences ─────────────────────────────────────────
export async function handleListTablePreferences(req: Request, res: Response): Promise<void> {
  const rows = await svc.listTablePreferences(userIdOf(req));
  res.status(200).json({ data: rows });
}

// ── 10. Filter presets ───────────────────────────────────────────
export async function handleListFilterPresets(req: Request, res: Response): Promise<void> {
  const rows = await svc.listFilterPresets(userIdOf(req));
  res.status(200).json({ data: rows });
}

// ── 11. Impersonation sessions ───────────────────────────────────
const impersonationSchema = z.object({
  reason: z.string().min(5),
});

export async function handleListImpersonationSessions(req: Request, res: Response): Promise<void> {
  const result = await svc.listImpersonationSessions(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

export async function handleStartImpersonation(req: Request, res: Response): Promise<void> {
  const parsed = impersonationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const adminId = (req as Request & { user?: { id: string } }).user?.id;
  if (!adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const targetUserId = userIdOf(req);
  if (adminId === targetUserId) {
    res.status(400).json({ error: "Cannot impersonate yourself" });
    return;
  }
  const row = await svc.startImpersonation(
    adminId,
    targetUserId,
    parsed.data.reason,
    req.ip,
    req.get("user-agent") ?? undefined,
  );
  res.status(201).json(row);
}

export async function handleEndImpersonation(req: Request, res: Response): Promise<void> {
  const id = req.params["impersonationId"] as string;
  const row = await svc.endImpersonation(id);
  res.status(200).json(row);
}

// ── 12. Archive entries ──────────────────────────────────────────
export async function handleListUserArchivedRecords(req: Request, res: Response): Promise<void> {
  const result = await svc.listUserArchivedRecords(userIdOf(req), pagination(req));
  res.status(200).json(result);
}

// ── 13. Force logout ─────────────────────────────────────────────
export async function handleForceLogoutUser(req: Request, res: Response): Promise<void> {
  const result = await svc.forceLogoutUser(userIdOf(req));
  res.status(200).json({ message: "All sessions revoked", ...result });
}

// ── 13a. Reset MFA ───────────────────────────────────────────────
export async function handleResetMfa(req: Request, res: Response): Promise<void> {
  const result = await svc.resetMfa(userIdOf(req));
  res.status(200).json({ message: "MFA reset", ...result });
}

// ── Unified godview summary ──────────────────────────────────────
export async function handleGetGodviewSummary(req: Request, res: Response): Promise<void> {
  const result = await svc.getGodviewSummary(userIdOf(req));
  res.status(200).json(result);
}
