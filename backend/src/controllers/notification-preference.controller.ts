import { z } from "zod";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import * as prefSvc from "../services/notification-preference.service.js";
import type { NotificationCategory } from "@prisma/client";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Zod Schemas
// ──────────────────────────────────────────────

const NotificationCategorySchema = z.enum([
  "DOCUMENT",
  "LEAVE",
  "ATTENDANCE",
  "RECRUITMENT",
  "ACCOUNT",
  "SYSTEM",
  "REPORT",
  "TARGET",
  "TASK",
  "GENERAL",
]);

const PreferenceFieldsSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    browserPushEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.isEnabled !== undefined ||
      data.emailEnabled !== undefined ||
      data.soundEnabled !== undefined ||
      data.browserPushEnabled !== undefined,
    { message: "At least one preference field must be provided" },
  );

const BulkUpdateSchema = z.object({
  preferences: z
    .array(
      z.object({
        category: NotificationCategorySchema,
        isEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        browserPushEnabled: z.boolean().optional(),
      }),
    )
    .min(1, "At least one preference entry is required")
    // Bumped from 8 → 12 when TASK + GENERAL joined the category enum
    .max(12, "Cannot exceed 12 preference entries"),
});

/**
 * §11.5 — Quiet hours window (HH:mm 24-hour). Either both fields are
 * provided (enable / update) or both are null (disable).
 */
const QuietHoursSchema = z
  .object({
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm")
      .nullable(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm")
      .nullable(),
  })
  .refine(
    (d) => (d.quietHoursStart === null) === (d.quietHoursEnd === null),
    {
      message:
        "Provide both quietHoursStart and quietHoursEnd to enable, or both null to disable",
      path: ["quietHoursEnd"],
    },
  );

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

/** GET /api/v1/notification-preferences/preferences */
export async function getMyPreferences(req: Request, res: Response): Promise<void> {
  const preferences = await prefSvc.getPreferences(req.user!.id);
  res.status(200).json({ preferences });
}

/** PATCH /api/v1/notification-preferences/preferences/:category */
export async function updateMyPreference(req: Request, res: Response): Promise<void> {
  const categoryResult = NotificationCategorySchema.safeParse(req.params["category"]);
  if (!categoryResult.success) {
    throw new AppError(
      `Invalid notification category: ${req.params["category"] as string}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      {
        details: categoryResult.error.issues.map((i) => ({
          path: "category",
          message: i.message,
        })),
      },
    );
  }

  const bodyResult = PreferenceFieldsSchema.safeParse(req.body);
  if (!bodyResult.success) {
    throw new AppError(
      "Invalid preference data",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      {
        details: bodyResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    );
  }

  const preference = await prefSvc.updatePreference(
    req.user!.id,
    categoryResult.data,
    bodyResult.data,
  );
  res.status(200).json({ preference });
}

/** PUT /api/v1/notification-preferences/preferences */
export async function updateMyPreferences(req: Request, res: Response): Promise<void> {
  const result = BulkUpdateSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(
      "Invalid preferences data",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      {
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    );
  }

  const preferences = await prefSvc.updateAllPreferences(
    req.user!.id,
    result.data.preferences.map((p) => ({
      category: p.category as NotificationCategory,
      isEnabled: p.isEnabled,
      emailEnabled: p.emailEnabled,
      soundEnabled: p.soundEnabled,
      browserPushEnabled: p.browserPushEnabled,
    })),
  );
  res.status(200).json({ preferences });
}

/**
 * GET /api/v1/notification-preferences/quiet-hours
 * Returns { quietHoursStart, quietHoursEnd } — both null when disabled.
 */
export async function getQuietHours(req: Request, res: Response): Promise<void> {
  const data = await prefSvc.getQuietHours(req.user!.id);
  res.status(HttpStatus.OK).json({ data });
}

/**
 * PATCH /api/v1/notification-preferences/quiet-hours
 * Body: { quietHoursStart, quietHoursEnd } — both HH:mm strings to enable,
 * both null to disable.
 */
export async function updateQuietHours(req: Request, res: Response): Promise<void> {
  const result = QuietHoursSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(
      "Invalid quiet hours",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      {
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    );
  }
  const data = await prefSvc.updateQuietHours(req.user!.id, result.data);
  res.status(HttpStatus.OK).json({ data });
}
