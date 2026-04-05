// ──────────────────────────────────────────────
//  Leave Validation Schemas
// ──────────────────────────────────────────────

import { z } from "zod";

export const leaveRequestSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    isHalfDay: z.boolean().default(false),
    reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveRejectSchema = z.object({
  rejectionReason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type LeaveRejectInput = z.infer<typeof leaveRejectSchema>;
