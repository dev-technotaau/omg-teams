// ──────────────────────────────────────────────
//  Target Validation Schemas
// ──────────────────────────────────────────────

import { z } from "zod";

export const targetSchema = z.object({
  recruiterId: z.string().min(1, "Recruiter is required"),
  targetType: z.enum(["DAILY", "WEEKLY", "MONTHLY"], { message: "Target type is required" }),
  targetValue: z.coerce.number().int().min(1, "Target value must be at least 1"),
  effectiveFrom: z.string().min(1, "Start date is required"),
  effectiveTo: z.string().optional(),
});

export type TargetInput = z.infer<typeof targetSchema>;
