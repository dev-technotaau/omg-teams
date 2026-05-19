import { z } from "zod";

// ──────────────────────────────────────────────
//  Task Validators — §Task
// ──────────────────────────────────────────────

export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createTaskSchema = z
  .object({
    subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(255),
    /** Tiptap HTML — at minimum must have something between tags. */
    body: z.string().min(1, "Body cannot be empty"),
    priority: taskPriorityEnum,
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    assigneeIds: z
      .array(z.string().min(1))
      .min(1, "Pick at least one assignee"),
  })
  .refine(
    (d) => {
      const s = new Date(d.startDate);
      const e = new Date(d.endDate);
      return !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s;
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  );

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
