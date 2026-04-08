// ──────────────────────────────────────────────
//  Target Validation Schemas
// ──────────────────────────────────────────────

import { z } from "zod";

export const targetSchema = z
  .object({
    /** null / empty string = Global Default (applies to all recruiters with no override) */
    recruiterId: z.string().nullable(),
    targetType: z.enum(["DAILY", "WEEKLY", "MONTHLY"], { message: "Target type is required" }),
    targetValue: z.coerce.number().int().min(1, "Target value must be at least 1"),
    effectiveFrom: z.string().min(1, "Start date is required"),
    effectiveTo: z.string().optional(),
  })
  .refine(
    (d) => {
      if (!d.effectiveTo) return true;
      const from = new Date(d.effectiveFrom);
      const to = new Date(d.effectiveTo);
      return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
    },
    { message: "End date must be on or after start date", path: ["effectiveTo"] },
  );

export type TargetInput = z.infer<typeof targetSchema>;
