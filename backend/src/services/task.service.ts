import {
  type Prisma,
  type TaskPriority,
  type TaskStatus,
  type TaskAssignmentStatus,
} from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { AppError } from "../exceptions/app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";

// ──────────────────────────────────────────────
//  Task Service — admin-assigned task workflow
//
//  Lifecycle:
//   Task.status   = ACTIVE → CANCELLED (admin can cancel the whole task)
//   Assignment    = PENDING → SUBMITTED → ACCEPTED
//                                       ↘ REJECTED → PENDING (resubmit)
//
//  Audit + notification side-effects live in the controller layer so the
//  service stays pure / testable.
// ──────────────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────

/**
 * Derived per-assignment time bucket — feeds the "Due in 3d / Overdue"
 * UI hints. Computed on read; never persisted.
 */
export type TaskTimeBucket = "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "ON_TRACK" | "NOT_STARTED";

export function deriveTimeBucket(
  startDate: Date,
  endDate: Date,
  status: TaskAssignmentStatus,
  now: Date = new Date(),
): TaskTimeBucket {
  // Resolved assignments don't have time pressure
  if (status === "ACCEPTED") return "ON_TRACK";
  if (now < startDate) return "NOT_STARTED";
  if (now > endDate) return "OVERDUE";
  const msLeft = endDate.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (msLeft <= dayMs) return "DUE_TODAY";
  if (msLeft <= 3 * dayMs) return "DUE_SOON";
  return "ON_TRACK";
}

export function daysUntil(boundary: Date, now: Date = new Date()): number {
  return Math.ceil((boundary.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const ASSIGNMENT_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, employeeId: true, role: true },
  },
  decidedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

const TASK_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  assignments: { include: ASSIGNMENT_INCLUDE, orderBy: { createdAt: "asc" as const } },
} as const;

/** Roll up per-assignment statuses into a single progress summary. */
function summarizeAssignments(
  assignments: { status: TaskAssignmentStatus }[],
): {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  /** 0-100, computed as accepted / total. */
  completionPercent: number;
} {
  let pending = 0;
  let submitted = 0;
  let accepted = 0;
  let rejected = 0;
  for (const a of assignments) {
    if (a.status === "PENDING") pending++;
    else if (a.status === "SUBMITTED") submitted++;
    else if (a.status === "ACCEPTED") accepted++;
    else if (a.status === "REJECTED") rejected++;
  }
  const total = assignments.length;
  const completionPercent = total === 0 ? 0 : Math.round((accepted / total) * 100);
  return { total, pending, submitted, accepted, rejected, completionPercent };
}

/** Public shape returned by list/get — includes derived progress + time bucket. */
type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

function enrichTask(t: TaskRow, now: Date = new Date()) {
  const summary = summarizeAssignments(t.assignments);
  return {
    ...t,
    progress: summary,
    daysUntilEnd: daysUntil(t.endDate, now),
    isOverdue:
      now > t.endDate &&
      t.status === "ACTIVE" &&
      t.assignments.some((a) => a.status !== "ACCEPTED"),
  };
}

// ── Create ──────────────────────────────────────────────────

export async function createTask(data: {
  subject: string;
  body: string;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  assigneeIds: string[];
  createdById: string;
}) {
  const prisma = getPrisma();

  // Validate dates
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid start or end date", HttpStatus.BAD_REQUEST, ErrorCode.INVALID_DATE);
  }
  if (end < start) {
    throw new AppError(
      "End date must be on or after start date",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_DATE_RANGE,
    );
  }
  if (data.assigneeIds.length === 0) {
    throw new AppError(
      "At least one assignee is required",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Validate assignees exist + are eligible (recruiter/RM, not deleted, not admin)
  const users = await prisma.user.findMany({
    where: {
      id: { in: data.assigneeIds },
      deletedAt: null,
      role: { in: ["RECRUITER", "REPORTING_MANAGER"] },
    },
    select: { id: true },
  });
  if (users.length !== data.assigneeIds.length) {
    const found = new Set(users.map((u) => u.id));
    const missing = data.assigneeIds.filter((id) => !found.has(id));
    throw new AppError(
      `Some assignees are invalid or not eligible (recruiter/RM only): ${missing.join(", ")}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const task = await prisma.task.create({
    data: {
      subject: data.subject.trim(),
      body: data.body,
      priority: data.priority,
      startDate: start,
      endDate: end,
      createdById: data.createdById,
      assignments: {
        create: data.assigneeIds.map((userId) => ({ userId })),
      },
    },
    include: TASK_INCLUDE,
  });

  return enrichTask(task);
}

// ── List (admin) ────────────────────────────────────────────

export interface AdminListFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  /** Filter to tasks where ANY assignment has this status. */
  assignmentStatus?: TaskAssignmentStatus;
  /** OVERDUE / DUE_TODAY / DUE_SOON — applied in-memory after enrichment. */
  timeBucket?: TaskTimeBucket;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "endDate" | "priority" | "subject";
  sortDir?: "asc" | "desc";
}

export async function listTasksAdmin(filters: AdminListFilters) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 200);
  const skip = (page - 1) * limit;

  const where: Prisma.TaskWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assigneeId) {
    where.assignments = { some: { userId: filters.assigneeId } };
  }
  if (filters.assignmentStatus) {
    where.assignments = {
      ...(where.assignments ?? {}),
      some: { ...(where.assignments?.some ?? {}), status: filters.assignmentStatus },
    };
  }
  if (filters.search) {
    where.subject = { contains: filters.search, mode: "insensitive" };
  }

  const sortBy = filters.sortBy ?? "createdAt";
  const sortDir = filters.sortDir ?? "desc";

  // Time-bucket is derived — can't push down to DB. Strategy: fetch a wider
  // page when the filter is set, then trim. For typical use (status filter
  // already in place) this works fine.
  const baseQuery = {
    where,
    include: TASK_INCLUDE,
    orderBy: { [sortBy]: sortDir } as Prisma.TaskOrderByWithRelationInput,
  };

  if (filters.timeBucket) {
    const rows = await prisma.task.findMany(baseQuery);
    const now = new Date();
    const enriched = rows.map((t) => enrichTask(t, now));
    const matched = enriched.filter((t) => {
      // Use the worst (most urgent) bucket across assignments
      const buckets = t.assignments.map((a) =>
        deriveTimeBucket(t.startDate, t.endDate, a.status, now),
      );
      return buckets.includes(filters.timeBucket!);
    });
    const total = matched.length;
    return {
      data: matched.slice(skip, skip + limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  const [data, total] = await Promise.all([
    prisma.task.findMany({ ...baseQuery, skip, take: limit }),
    prisma.task.count({ where }),
  ]);

  const now = new Date();
  return {
    data: data.map((t) => enrichTask(t, now)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── List (employee — "My Tasks") ────────────────────────────

export async function listMyTasks(
  userId: string,
  filters: {
    status?: TaskAssignmentStatus;
    timeBucket?: TaskTimeBucket;
    priority?: TaskPriority;
    search?: string;
  } = {},
) {
  const prisma = getPrisma();
  const assignments = await prisma.taskAssignment.findMany({
    where: {
      userId,
      ...(filters.status && { status: filters.status }),
      task: {
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && {
          subject: { contains: filters.search, mode: "insensitive" },
        }),
      },
    },
    include: {
      task: { include: TASK_INCLUDE },
    },
    orderBy: [{ task: { endDate: "asc" } }, { task: { priority: "desc" } }],
  });

  const now = new Date();
  const enriched = assignments.map((a) => ({
    ...a,
    timeBucket: deriveTimeBucket(a.task.startDate, a.task.endDate, a.status, now),
    daysUntilEnd: daysUntil(a.task.endDate, now),
    task: enrichTask(a.task, now),
  }));
  if (filters.timeBucket) {
    return enriched.filter((a) => a.timeBucket === filters.timeBucket);
  }
  return enriched;
}

/**
 * Count of assignments the employee hasn't actioned yet (PENDING or
 * REJECTED-awaiting-resubmit). Drives the sidebar "Tasks (N)" badge.
 */
export async function getMyOpenTaskCount(userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.taskAssignment.count({
    where: {
      userId,
      status: { in: ["PENDING", "REJECTED"] },
      task: { deletedAt: null, status: "ACTIVE" },
    },
  });
}

// ── Get by id ──────────────────────────────────────────────

export async function getTaskById(id: string) {
  const prisma = getPrisma();
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: TASK_INCLUDE,
  });
  if (!task) {
    throw new AppError("Task not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  return enrichTask(task);
}

// ── Update (admin only — subject/body/priority/dates) ─────────

export async function updateTask(
  id: string,
  data: {
    subject?: string | undefined;
    body?: string | undefined;
    priority?: TaskPriority | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError("Task not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  if (existing.status === "CANCELLED") {
    throw new AppError(
      "Cannot edit a cancelled task",
      HttpStatus.CONFLICT,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const updateData: Prisma.TaskUpdateInput = {};
  if (data.subject !== undefined) updateData.subject = data.subject.trim();
  if (data.body !== undefined) updateData.body = data.body;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.startDate !== undefined) {
    const d = new Date(data.startDate);
    if (Number.isNaN(d.getTime())) {
      throw new AppError("Invalid start date", HttpStatus.BAD_REQUEST, ErrorCode.INVALID_DATE);
    }
    updateData.startDate = d;
  }
  if (data.endDate !== undefined) {
    const d = new Date(data.endDate);
    if (Number.isNaN(d.getTime())) {
      throw new AppError("Invalid end date", HttpStatus.BAD_REQUEST, ErrorCode.INVALID_DATE);
    }
    updateData.endDate = d;
  }

  // Cross-check: new endDate (or existing) must be ≥ new/existing startDate
  const finalStart = (updateData.startDate as Date | undefined) ?? existing.startDate;
  const finalEnd = (updateData.endDate as Date | undefined) ?? existing.endDate;
  if (finalEnd < finalStart) {
    throw new AppError(
      "End date must be on or after start date",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_DATE_RANGE,
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: TASK_INCLUDE,
  });
  return { existing, updated: enrichTask(updated) };
}

// ── Reassign / add or remove assignees ───────────────────────

/**
 * Replace the assignee list with `userIds`. Removed assignees: their
 * TaskAssignment rows are deleted (only if PENDING — won't blow away a
 * submission). New assignees: PENDING TaskAssignment created.
 */
export async function reassignTask(taskId: string, userIds: string[]) {
  const prisma = getPrisma();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { assignments: true },
  });
  if (!task) {
    throw new AppError("Task not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  if (task.status === "CANCELLED") {
    throw new AppError(
      "Cannot reassign a cancelled task",
      HttpStatus.CONFLICT,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  if (userIds.length === 0) {
    throw new AppError(
      "At least one assignee is required",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Validate new ids
  const valid = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      deletedAt: null,
      role: { in: ["RECRUITER", "REPORTING_MANAGER"] },
    },
    select: { id: true },
  });
  if (valid.length !== userIds.length) {
    throw new AppError(
      "Some assignees are invalid",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const existingIds = new Set(task.assignments.map((a) => a.userId));
  const newIds = new Set(userIds);

  const toAdd = userIds.filter((id) => !existingIds.has(id));
  const toRemove = task.assignments
    // Only remove untouched PENDING assignments. Don't yank a submission out
    // from under the reviewing admin.
    .filter((a) => !newIds.has(a.userId) && a.status === "PENDING")
    .map((a) => a.id);

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [prisma.taskAssignment.deleteMany({ where: { id: { in: toRemove } } })]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.taskAssignment.createMany({
            data: toAdd.map((userId) => ({ taskId, userId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  const updated = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: TASK_INCLUDE,
  });

  return {
    task: enrichTask(updated),
    added: toAdd,
    removed: toRemove.length, // count, not ids (already deleted)
    /** ids requested for removal but kept because the assignment was past PENDING. */
    keptDueToProgress: task.assignments
      .filter((a) => !newIds.has(a.userId) && a.status !== "PENDING")
      .map((a) => a.userId),
  };
}

// ── Cancel (admin) ───────────────────────────────────────────

export async function cancelTask(id: string, reason: string | null) {
  const prisma = getPrisma();
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError("Task not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  if (existing.status === "CANCELLED") return existing;
  return prisma.task.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
}

// ── Soft delete (admin) ──────────────────────────────────────

export async function deleteTask(id: string, actorId: string) {
  const prisma = getPrisma();
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError("Task not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  return prisma.task.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });
}

// ── Submit (employee marks complete) ─────────────────────────

export async function submitMyAssignment(
  taskId: string,
  userId: string,
  submissionNote: string | null,
) {
  const prisma = getPrisma();
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
    include: { task: true },
  });
  if (!assignment) {
    throw new AppError("Assignment not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  if (assignment.task.deletedAt || assignment.task.status === "CANCELLED") {
    throw new AppError(
      "Task is no longer active",
      HttpStatus.CONFLICT,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  if (assignment.status !== "PENDING" && assignment.status !== "REJECTED") {
    throw new AppError(
      `Cannot submit while assignment is ${assignment.status}`,
      HttpStatus.CONFLICT,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  const updated = await prisma.taskAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      submissionNote,
      submissionCount: { increment: 1 },
      // Wipe the previous decision so the admin sees a fresh review row
      decidedAt: null,
      decidedById: null,
      decisionNote: null,
    },
    include: ASSIGNMENT_INCLUDE,
  });
  return { previous: assignment, updated };
}

// ── Accept / Reject (admin reviewing a submission) ───────────

export async function decideAssignment(
  assignmentId: string,
  decision: "ACCEPTED" | "REJECTED",
  decisionNote: string | null,
  adminId: string,
) {
  const prisma = getPrisma();
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    include: { task: true },
  });
  if (!assignment) {
    throw new AppError("Assignment not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
  if (assignment.status !== "SUBMITTED") {
    throw new AppError(
      `Can only decide on SUBMITTED assignments (current: ${assignment.status})`,
      HttpStatus.CONFLICT,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  if (decision === "REJECTED" && !decisionNote?.trim()) {
    throw new AppError(
      "Rejection note is required",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  const updated = await prisma.taskAssignment.update({
    where: { id: assignmentId },
    data: {
      status: decision,
      decidedAt: new Date(),
      decidedById: adminId,
      decisionNote: decisionNote ?? null,
    },
    include: ASSIGNMENT_INCLUDE,
  });
  return { previous: assignment, updated };
}

// ── Stats for dashboard / analytics ──────────────────────────

export async function getAdminTaskStats() {
  const prisma = getPrisma();
  const now = new Date();
  const [byStatus, byPriority, overdueCount, dueSoonCount, total] = await Promise.all([
    prisma.taskAssignment.groupBy({
      by: ["status"],
      where: { task: { deletedAt: null, status: "ACTIVE" } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["priority"],
      where: { deletedAt: null, status: "ACTIVE" },
      _count: true,
    }),
    prisma.taskAssignment.count({
      where: {
        status: { in: ["PENDING", "REJECTED"] },
        task: { deletedAt: null, status: "ACTIVE", endDate: { lt: now } },
      },
    }),
    prisma.taskAssignment.count({
      where: {
        status: { in: ["PENDING", "REJECTED"] },
        task: {
          deletedAt: null,
          status: "ACTIVE",
          endDate: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
        },
      },
    }),
    prisma.task.count({ where: { deletedAt: null } }),
  ]);

  const statusCounts: Record<TaskAssignmentStatus, number> = {
    PENDING: 0,
    SUBMITTED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
  };
  for (const row of byStatus) statusCounts[row.status] = row._count;

  const priorityCounts: Record<TaskPriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };
  for (const row of byPriority) priorityCounts[row.priority] = row._count;

  return {
    total,
    awaitingReview: statusCounts.SUBMITTED,
    pending: statusCounts.PENDING,
    accepted: statusCounts.ACCEPTED,
    rejected: statusCounts.REJECTED,
    overdue: overdueCount,
    dueSoon: dueSoonCount,
    byPriority: priorityCounts,
  };
}

/**
 * Per-user task summary for the employee Performance panel.
 * Counts the user's own assignment rows by status, time-pressure, and the
 * total they've ever been part of (helps frame the completion %).
 */
export async function getUserTaskMetrics(userId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const assignments = await prisma.taskAssignment.findMany({
    where: { userId, task: { deletedAt: null } },
    select: {
      status: true,
      submittedAt: true,
      task: { select: { startDate: true, endDate: true, status: true } },
    },
  });
  let pending = 0;
  let submitted = 0;
  let accepted = 0;
  let rejected = 0;
  let overdue = 0;
  let onTime = 0;
  let lateSubmissions = 0;
  for (const a of assignments) {
    if (a.task.status === "CANCELLED") continue;
    if (a.status === "PENDING") pending++;
    if (a.status === "SUBMITTED") submitted++;
    if (a.status === "ACCEPTED") {
      accepted++;
      if (a.submittedAt && a.submittedAt > a.task.endDate) lateSubmissions++;
      else onTime++;
    }
    if (a.status === "REJECTED") rejected++;
    if ((a.status === "PENDING" || a.status === "REJECTED") && now > a.task.endDate) overdue++;
  }
  const total = pending + submitted + accepted + rejected;
  return {
    total,
    pending,
    submitted,
    accepted,
    rejected,
    overdue,
    completionRate: total === 0 ? 0 : Math.round((accepted / total) * 100),
    onTimeRate: accepted === 0 ? 0 : Math.round((onTime / accepted) * 100),
    lateSubmissions,
  };
}
