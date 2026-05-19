import { z } from "zod";
import * as taskSvc from "../services/task.service.js";
import { logAudit } from "../services/audit.service.js";
import {
  onTaskAssigned,
  onTaskSubmitted,
  onTaskAccepted,
  onTaskRejected,
  onTaskCancelled,
  onTaskReassigned,
  onTaskExtended,
} from "../services/notification-triggers.js";
import { getPrisma } from "../config/database.js";
import { AppError } from "../exceptions/app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Tasks Controller — §Task
//
//  Admin endpoints handle create / list / update / reassign / cancel /
//  delete / review-decisions. Employee endpoints handle my-tasks list,
//  submit / resubmit, and open-count for the sidebar badge.
//
//  Every mutating action writes an AuditLog entry with entityType=Task
//  (or TaskAssignment for assignment-level decisions) so the per-row
//  history view stays accurate.
// ──────────────────────────────────────────────

const TASK_ENTITY = "Task";
const TASK_ASSIGNMENT_ENTITY = "TaskAssignment";

// ── Shared validators ──────────────────────────────────────────

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const taskStatusEnum = z.enum(["ACTIVE", "CANCELLED"]);
const assignmentStatusEnum = z.enum(["PENDING", "SUBMITTED", "ACCEPTED", "REJECTED"]);
const timeBucketEnum = z.enum(["OVERDUE", "DUE_TODAY", "DUE_SOON", "ON_TRACK", "NOT_STARTED"]);

const createTaskSchema = z
  .object({
    subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(255),
    body: z.string().min(1, "Body cannot be empty"),
    priority: priorityEnum.default("MEDIUM"),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    assigneeIds: z.array(z.string().min(1)).min(1, "Pick at least one assignee"),
  })
  .refine(
    (d) => {
      const s = new Date(d.startDate);
      const e = new Date(d.endDate);
      return !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s;
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  );

const updateTaskSchema = z.object({
  subject: z.string().trim().min(3).max(255).optional(),
  body: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const reassignSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

const submitSchema = z.object({
  submissionNote: z.string().trim().max(2000).optional(),
});

const decisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  decisionNote: z.string().trim().max(2000).optional(),
});

// ── Admin endpoints ─────────────────────────────────────────────

/** POST /api/v1/tasks — admin creates a task */
export async function handleCreateTask(req: Request, res: Response): Promise<void> {
  const body = createTaskSchema.parse(req.body);
  const task = await taskSvc.createTask({
    subject: body.subject,
    body: body.body,
    priority: body.priority,
    startDate: body.startDate,
    endDate: body.endDate,
    assigneeIds: body.assigneeIds,
    createdById: req.user!.id,
  });

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "CREATE",
    entityType: TASK_ENTITY,
    entityId: task.id,
    changes: {
      subject: { old: null, new: task.subject },
      priority: { old: null, new: task.priority },
      startDate: { old: null, new: task.startDate.toISOString() },
      endDate: { old: null, new: task.endDate.toISOString() },
      assigneeIds: { old: null, new: body.assigneeIds },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Fire-and-forget notifications
  void onTaskAssigned(body.assigneeIds, {
    taskId: task.id,
    subject: task.subject,
    priority: task.priority,
    endDate: task.endDate,
  });

  res.status(HttpStatus.CREATED).json({ data: task });
}

/** GET /api/v1/tasks — admin list (paginated, filterable) */
export async function handleListTasksAdmin(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: taskSvc.AdminListFilters = {
    ...(typeof q["status"] === "string" &&
      taskStatusEnum.safeParse(q["status"]).success && {
        status: q["status"] as "ACTIVE" | "CANCELLED",
      }),
    ...(typeof q["priority"] === "string" &&
      priorityEnum.safeParse(q["priority"]).success && {
        priority: q["priority"] as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      }),
    ...(typeof q["assigneeId"] === "string" && { assigneeId: q["assigneeId"] }),
    ...(typeof q["assignmentStatus"] === "string" &&
      assignmentStatusEnum.safeParse(q["assignmentStatus"]).success && {
        assignmentStatus: q["assignmentStatus"] as
          | "PENDING"
          | "SUBMITTED"
          | "ACCEPTED"
          | "REJECTED",
      }),
    ...(typeof q["timeBucket"] === "string" &&
      timeBucketEnum.safeParse(q["timeBucket"]).success && {
        timeBucket: q["timeBucket"] as taskSvc.TaskTimeBucket,
      }),
    ...(typeof q["search"] === "string" && q["search"] && { search: q["search"] }),
    ...(q["page"] && { page: Number(q["page"]) }),
    ...(q["limit"] && { limit: Number(q["limit"]) }),
    ...(typeof q["sortBy"] === "string" && {
      sortBy: q["sortBy"] as AdminSortBy,
    }),
    ...(typeof q["sortDir"] === "string" &&
      (q["sortDir"] === "asc" || q["sortDir"] === "desc") && {
        sortDir: q["sortDir"],
      }),
  };
  const result = await taskSvc.listTasksAdmin(filters);
  res.status(HttpStatus.OK).json(result);
}
type AdminSortBy = NonNullable<taskSvc.AdminListFilters["sortBy"]>;

/** GET /api/v1/tasks/stats — admin stats card data */
export async function handleAdminTaskStats(_req: Request, res: Response): Promise<void> {
  const stats = await taskSvc.getAdminTaskStats();
  res.status(HttpStatus.OK).json({ data: stats });
}

/** GET /api/v1/tasks/:id — admin detail (also reachable by an assignee) */
export async function handleGetTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const task = await taskSvc.getTaskById(id);
  // RBAC: admin always; otherwise the requester must be an assignee
  if (req.user!.role !== "ADMIN") {
    const isAssignee = task.assignments.some((a) => a.userId === req.user!.id);
    if (!isAssignee) {
      throw new AppError("Not authorized to view this task", HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
  }
  res.status(HttpStatus.OK).json({ data: task });
}

/** PATCH /api/v1/tasks/:id — admin edit */
export async function handleUpdateTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const body = updateTaskSchema.parse(req.body);
  const { existing, updated } = await taskSvc.updateTask(id, body);

  // Diff for audit
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of ["subject", "body", "priority", "startDate", "endDate"] as const) {
    const before = existing[key];
    const after = updated[key];
    const a = before instanceof Date ? before.toISOString() : before;
    const b = after instanceof Date ? after.toISOString() : after;
    if (a !== b) changes[key] = { old: a, new: b };
  }
  if (Object.keys(changes).length > 0) {
    logAudit({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: "UPDATE",
      entityType: TASK_ENTITY,
      entityId: id,
      changes,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  }

  // If endDate moved later → notify active assignees of the extension
  if (
    "endDate" in changes &&
    updated.endDate > existing.endDate &&
    updated.status === "ACTIVE"
  ) {
    void onTaskExtended(
      updated.assignments
        .filter((a) => a.status !== "ACCEPTED")
        .map((a) => a.userId),
      updated.subject,
      updated.id,
      updated.endDate,
    );
  }

  res.status(HttpStatus.OK).json({ data: updated });
}

/** PATCH /api/v1/tasks/:id/reassign — replace the assignee list */
export async function handleReassignTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const { userIds } = reassignSchema.parse(req.body);
  const result = await taskSvc.reassignTask(id, userIds);

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "UPDATE",
    entityType: TASK_ENTITY,
    entityId: id,
    changes: {
      assigneeIds: { old: null, new: userIds },
      added: { old: null, new: result.added },
      removedCount: { old: null, new: result.removed },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Notify added + (silently) kept-due-to-progress are not removed.
  // For removals, the service only deletes PENDING — those assignees get
  // a "removed from task" notification.
  const previousIds = new Set(
    result.task.assignments.map((a) => a.userId).concat(result.keptDueToProgress),
  );
  const removedIds = previousIds.size === 0 ? [] : userIds.filter((u) => !previousIds.has(u));
  void onTaskReassigned(result.added, removedIds, result.task.subject, id);

  res.status(HttpStatus.OK).json({ data: result });
}

/** PATCH /api/v1/tasks/:id/cancel — soft cancel (preserves history) */
export async function handleCancelTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const { reason } = cancelSchema.parse(req.body);

  const before = await taskSvc.getTaskById(id);
  const assigneeIdsToNotify = before.assignments
    .filter((a) => a.status !== "ACCEPTED")
    .map((a) => a.userId);

  await taskSvc.cancelTask(id, reason ?? null);

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "UPDATE",
    entityType: TASK_ENTITY,
    entityId: id,
    changes: {
      status: { old: before.status, new: "CANCELLED" },
      reason: { old: null, new: reason ?? null },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  void onTaskCancelled(assigneeIdsToNotify, before.subject, id, reason ?? null);

  res.status(HttpStatus.OK).json({ message: "Task cancelled" });
}

/** DELETE /api/v1/tasks/:id — soft delete */
export async function handleDeleteTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  await taskSvc.deleteTask(id, req.user!.id);

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "DELETE",
    entityType: TASK_ENTITY,
    entityId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  res.status(HttpStatus.OK).json({ message: "Task deleted" });
}

/** GET /api/v1/tasks/:id/history — audit timeline */
export async function handleTaskHistory(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const { listAuditLogs } = await import("../services/audit.service.js");
  // Task-level events
  const taskRows = await listAuditLogs({
    entityType: TASK_ENTITY,
    entityId: id,
    page: 1,
    limit: 100,
  });
  // Assignment-level events (admin decisions, employee submissions)
  const prisma = getPrisma();
  const assignmentIds = await prisma.taskAssignment.findMany({
    where: { taskId: id },
    select: { id: true },
  });
  const assignmentEvents = await Promise.all(
    assignmentIds.map((a) =>
      listAuditLogs({
        entityType: TASK_ASSIGNMENT_ENTITY,
        entityId: a.id,
        page: 1,
        limit: 100,
      }),
    ),
  );
  const all = [
    ...taskRows.data,
    ...assignmentEvents.flatMap((r) => r.data),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  res.status(HttpStatus.OK).json({ data: all });
}

/** POST /api/v1/tasks/assignments/:assignmentId/decision — admin accept/reject */
export async function handleDecideAssignment(req: Request, res: Response): Promise<void> {
  const id = req.params["assignmentId"] as string;
  const body = decisionSchema.parse(req.body);
  const { previous, updated } = await taskSvc.decideAssignment(
    id,
    body.decision,
    body.decisionNote ?? null,
    req.user!.id,
  );

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "UPDATE",
    entityType: TASK_ASSIGNMENT_ENTITY,
    entityId: id,
    changes: {
      status: { old: previous.status, new: updated.status },
      decisionNote: { old: previous.decisionNote, new: updated.decisionNote },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Fetch the task subject for the notification copy
  const prisma = getPrisma();
  const task = await prisma.task.findUnique({
    where: { id: previous.taskId },
    select: { subject: true },
  });
  const subject = task?.subject ?? "Task";

  if (body.decision === "ACCEPTED") {
    void onTaskAccepted(previous.userId, subject, previous.taskId);
  } else {
    void onTaskRejected(
      previous.userId,
      subject,
      previous.taskId,
      body.decisionNote ?? "(no reason provided)",
    );
  }

  res.status(HttpStatus.OK).json({ data: updated });
}

// ── Employee endpoints ─────────────────────────────────────────

/** GET /api/v1/tasks/me — employee list of their own assignments */
export async function handleListMyTasks(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: Parameters<typeof taskSvc.listMyTasks>[1] = {
    ...(typeof q["status"] === "string" &&
      assignmentStatusEnum.safeParse(q["status"]).success && {
        status: q["status"] as "PENDING" | "SUBMITTED" | "ACCEPTED" | "REJECTED",
      }),
    ...(typeof q["priority"] === "string" &&
      priorityEnum.safeParse(q["priority"]).success && {
        priority: q["priority"] as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      }),
    ...(typeof q["timeBucket"] === "string" &&
      timeBucketEnum.safeParse(q["timeBucket"]).success && {
        timeBucket: q["timeBucket"] as taskSvc.TaskTimeBucket,
      }),
    ...(typeof q["search"] === "string" && q["search"] && { search: q["search"] }),
  };
  const data = await taskSvc.listMyTasks(req.user!.id, filters);
  res.status(HttpStatus.OK).json({ data });
}

/** GET /api/v1/tasks/me/open-count — sidebar badge */
export async function handleMyOpenTaskCount(req: Request, res: Response): Promise<void> {
  const count = await taskSvc.getMyOpenTaskCount(req.user!.id);
  res.status(HttpStatus.OK).json({ data: { count } });
}

/** POST /api/v1/tasks/:id/submit — employee marks complete */
export async function handleSubmitTask(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const body = submitSchema.parse(req.body);
  const { previous, updated } = await taskSvc.submitMyAssignment(
    id,
    req.user!.id,
    body.submissionNote ?? null,
  );

  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "UPDATE",
    entityType: TASK_ASSIGNMENT_ENTITY,
    entityId: updated.id,
    changes: {
      status: { old: previous.status, new: "SUBMITTED" },
      submissionNote: { old: null, new: body.submissionNote ?? null },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  // Notify admin pool that a submission needs review
  const prisma = getPrisma();
  const task = await prisma.task.findUnique({
    where: { id },
    select: { subject: true },
  });
  void onTaskSubmitted(updated.id, id, task?.subject ?? "Task", req.user!.id);

  res.status(HttpStatus.OK).json({ data: updated });
}

/** GET /api/v1/tasks/user-metrics/:userId — admin: per-user stats for Performance panel */
export async function handleGetUserTaskMetrics(req: Request, res: Response): Promise<void> {
  const userId = req.params["userId"] as string;
  const metrics = await taskSvc.getUserTaskMetrics(userId);
  res.status(HttpStatus.OK).json({ data: metrics });
}
