import crypto from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Webhook CRUD Controller — Admin-only
// ──────────────────────────────────────────────

/** Safely extract string param from Express req.params */
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  if (typeof val !== "string") {
    throw new AppError(
      `Missing parameter: ${key}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }
  return val;
}

/** All supported webhook event types */
export const WEBHOOK_EVENTS = [
  "candidate.created",
  "candidate.updated",
  "candidate.stage_changed",
  "candidate.deleted",
  "attendance.punch_in",
  "attendance.punch_out",
  "attendance.absent_detected",
  "leave.requested",
  "leave.approved",
  "leave.rejected",
  "user.created",
  "user.updated",
  "user.deleted",
  "document.uploaded",
  "document.verified",
  "report.generated",
  "invoice.created",
  "system.maintenance",
] as const;

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().max(255).optional(),
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

/** GET /webhooks — List all webhook endpoints */
export async function handleListWebhooks(_req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();

  const webhooks = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
    },
  });

  res.json({ webhooks });
}

/** GET /webhooks/events — List available webhook event types */
export function handleListEvents(_req: Request, res: Response): void {
  res.json({ events: WEBHOOK_EVENTS });
}

/** POST /webhooks — Create a new webhook endpoint */
export async function handleCreateWebhook(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const { url, events, description } = createSchema.parse(req.body);

  // Generate a signing secret
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

  const webhook = await prisma.webhookEndpoint.create({
    data: {
      url,
      secret,
      events,
      createdBy: req.user!.id,
      ...(description ? { description } : {}),
    },
  });

  logger.info("Webhook endpoint created", { id: webhook.id, url });

  // Return secret only on creation — it won't be shown again
  res.status(HttpStatus.CREATED).json({
    webhook: {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    },
    secret,
  });
}

/** PATCH /webhooks/:id — Update a webhook endpoint */
export async function handleUpdateWebhook(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const id = getParam(req, "id");
  const data = updateSchema.parse(req.body);

  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Webhook endpoint not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const webhook = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(data.url ? { url: data.url } : {}),
      ...(data.events ? { events: data.events } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: {
      id: true,
      url: true,
      events: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info("Webhook endpoint updated", { id });
  res.json({ webhook });
}

/** DELETE /webhooks/:id — Delete a webhook endpoint */
export async function handleDeleteWebhook(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const id = getParam(req, "id");

  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Webhook endpoint not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  await prisma.webhookEndpoint.delete({ where: { id } });

  logger.info("Webhook endpoint deleted", { id });
  res.json({ success: true });
}

/** POST /webhooks/:id/test — Send a test ping to a webhook endpoint */
export async function handleTestWebhook(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const id = getParam(req, "id");

  const webhook = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!webhook) {
    throw new AppError("Webhook endpoint not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const payload = {
    event: "webhook.test",
    payload: { message: "Test webhook delivery from OMG Teams" },
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    res.json({
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ success: false, error: message });
  }
}

/** POST /webhooks/:id/rotate-secret — Rotate the signing secret */
export async function handleRotateSecret(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const id = getParam(req, "id");

  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Webhook endpoint not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

  await prisma.webhookEndpoint.update({
    where: { id },
    data: { secret },
  });

  logger.info("Webhook secret rotated", { id });
  res.json({ secret });
}
