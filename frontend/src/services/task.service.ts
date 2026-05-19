import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Task Service — §Task
//  Typed client for /api/v1/tasks
// ──────────────────────────────────────────────

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "ACTIVE" | "CANCELLED";
export type TaskAssignmentStatus = "PENDING" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
export type TaskTimeBucket =
  | "OVERDUE"
  | "DUE_TODAY"
  | "DUE_SOON"
  | "ON_TRACK"
  | "NOT_STARTED";

export interface TaskAssignee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  role: string;
}

export interface TaskAssignmentRow {
  id: string;
  taskId: string;
  userId: string;
  status: TaskAssignmentStatus;
  submittedAt: string | null;
  submissionNote: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  decisionNote: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  user: TaskAssignee;
  decidedBy: { id: string; firstName: string; lastName: string } | null;
}

export interface TaskProgress {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  completionPercent: number;
}

export interface Task {
  id: string;
  subject: string;
  /** Tiptap HTML. */
  body: string;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdById: string;
  createdBy: { id: string; firstName: string; lastName: string };
  assignments: TaskAssignmentRow[];
  createdAt: string;
  updatedAt: string;
  /** Days until endDate (negative = overdue, null = ongoing). */
  daysUntilEnd: number;
  isOverdue: boolean;
  progress: TaskProgress;
}

export interface MyTaskRow extends TaskAssignmentRow {
  timeBucket: TaskTimeBucket;
  daysUntilEnd: number;
  task: Task;
}

export interface AdminListResponse {
  data: Task[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminTaskStats {
  total: number;
  awaitingReview: number;
  pending: number;
  accepted: number;
  rejected: number;
  overdue: number;
  dueSoon: number;
  byPriority: Record<TaskPriority, number>;
}

export interface UserTaskMetrics {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  onTimeRate: number;
  lateSubmissions: number;
}

export interface AdminListFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  assignmentStatus?: TaskAssignmentStatus;
  timeBucket?: TaskTimeBucket;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "endDate" | "priority" | "subject";
  sortDir?: "asc" | "desc";
}

// ── Admin ───────────────────────────────────────────────────

export async function listTasksAdmin(filters: AdminListFilters = {}) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params[k] = String(v);
  }
  const res = await api.get<AdminListResponse>("/tasks", { params });
  return res.data;
}

export async function getAdminTaskStats() {
  const res = await api.get<{ data: AdminTaskStats }>("/tasks/stats");
  return res.data.data;
}

export async function createTask(data: {
  subject: string;
  body: string;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  assigneeIds: string[];
}) {
  const res = await api.post<{ data: Task }>("/tasks", data);
  return res.data.data;
}

export async function updateTask(
  id: string,
  data: Partial<{
    subject: string;
    body: string;
    priority: TaskPriority;
    startDate: string;
    endDate: string;
  }>,
) {
  const res = await api.patch<{ data: Task }>(`/tasks/${id}`, data);
  return res.data.data;
}

export async function reassignTask(id: string, userIds: string[]) {
  const res = await api.patch<{
    data: { task: Task; added: string[]; removed: number; keptDueToProgress: string[] };
  }>(`/tasks/${id}/reassign`, { userIds });
  return res.data.data;
}

export async function cancelTask(id: string, reason?: string) {
  await api.patch(`/tasks/${id}/cancel`, { reason });
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}

export async function getTask(id: string) {
  const res = await api.get<{ data: Task }>(`/tasks/${id}`);
  return res.data.data;
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ipAddress: string | null;
  user: { firstName: string; lastName: string; employeeId: string | null } | null;
}

export async function getTaskHistory(id: string) {
  const res = await api.get<{ data: TaskHistoryEntry[] }>(`/tasks/${id}/history`);
  return res.data.data;
}

export async function decideAssignment(
  assignmentId: string,
  decision: "ACCEPTED" | "REJECTED",
  decisionNote?: string,
) {
  const res = await api.post<{ data: TaskAssignmentRow }>(
    `/tasks/assignments/${assignmentId}/decision`,
    { decision, decisionNote },
  );
  return res.data.data;
}

export async function getUserTaskMetrics(userId: string) {
  const res = await api.get<{ data: UserTaskMetrics }>(`/tasks/user-metrics/${userId}`);
  return res.data.data;
}

// ── Employee ────────────────────────────────────────────────

export async function listMyTasks(filters: {
  status?: TaskAssignmentStatus;
  priority?: TaskPriority;
  timeBucket?: TaskTimeBucket;
  search?: string;
} = {}) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params[k] = String(v);
  }
  const res = await api.get<{ data: MyTaskRow[] }>("/tasks/me", { params });
  return res.data.data;
}

export async function getMyOpenTaskCount() {
  const res = await api.get<{ data: { count: number } }>("/tasks/me/open-count");
  return res.data.data.count;
}

export async function submitTask(taskId: string, submissionNote?: string) {
  const res = await api.post<{ data: TaskAssignmentRow }>(`/tasks/${taskId}/submit`, {
    submissionNote,
  });
  return res.data.data;
}
