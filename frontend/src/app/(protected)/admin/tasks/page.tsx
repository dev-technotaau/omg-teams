"use client";

// ──────────────────────────────────────────────
//  Admin → Task Management (§Task)
//
//  Full-feature management page consistent with /admin/targets pattern:
//   - Stats strip (cards) + filters (status / priority / time bucket / assignee / search)
//   - DataTable (table + card view) with sortable columns + pagination
//   - Create modal with Tiptap body, multi-assignee picker, dates, priority
//   - Edit modal (same fields)
//   - Per-row actions: Edit / Reassign / Extend dates / Cancel / Delete / History / Review (when SUBMITTED)
//   - Review modal: accept or reject with note
//   - History modal: audit timeline + per-assignment events
// ──────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  XCircle,
  Search,
  Users,
  AlertTriangle,
  Clock,
  CheckSquare,
  CheckCircle2,
  XOctagon,
  History as HistoryIcon,
  RotateCw,
  Eye,
  CalendarClock,
  ArrowRight,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  listTasksAdmin,
  getAdminTaskStats,
  createTask,
  updateTask,
  reassignTask,
  cancelTask,
  deleteTask,
  getTaskHistory,
  decideAssignment,
  type Task,
  type TaskAssignmentRow,
  type TaskAssignmentStatus,
  type TaskPriority,
  type TaskTimeBucket,
  type TaskHistoryEntry,
} from "@/services/task.service";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  IconButton,
  Tooltip,
  Modal,
  FormField,
  Input,
  Textarea,
  Select,
  DatePicker,
  DataTable,
  Progress,
  ConfirmDialog,
} from "@/components/ui";
import type { Column, ViewType } from "@/components/ui";
import { TiptapEditor } from "@/components/tiptap-editor";
import { useClickOutside } from "@/hooks/use-click-outside";
import { createTaskSchema } from "@/validators/task";

// ── Types & options ────────────────────────────────────────────

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  role: string;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const ASSIGNMENT_STATUS_VARIANT: Record<
  TaskAssignmentStatus,
  "default" | "info" | "warning" | "success" | "danger"
> = {
  PENDING: "default",
  SUBMITTED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
};

const TIME_BUCKET_LABEL: Record<TaskTimeBucket, string> = {
  OVERDUE: "Overdue",
  DUE_TODAY: "Due Today",
  DUE_SOON: "Due Soon (≤3d)",
  ON_TRACK: "On Track",
  NOT_STARTED: "Not Started",
};

// ── Empty form template ────────────────────────────────────────

interface FormState {
  subject: string;
  body: string;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  assigneeIds: string[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const emptyForm: FormState = {
  subject: "",
  body: "<p></p>",
  priority: "MEDIUM",
  startDate: todayISO(),
  endDate: addDaysISO(7),
  assigneeIds: [],
};

// ──────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────

export default function AdminTasksPage() {
  const qc = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "CANCELLED">("ACTIVE");
  const [filterPriority, setFilterPriority] = useState<"" | TaskPriority>("");
  const [filterTimeBucket, setFilterTimeBucket] = useState<"" | TaskTimeBucket>("");
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<"" | TaskAssignmentStatus>(
    "",
  );
  const [filterAssignee, setFilterAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState<"createdAt" | "endDate" | "priority" | "subject">(
    "createdAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [reassignTaskState, setReassignTaskState] = useState<Task | null>(null);
  const [extendTask, setExtendTask] = useState<Task | null>(null);
  const [cancelTaskState, setCancelTaskState] = useState<Task | null>(null);
  const [deleteTaskState, setDeleteTaskState] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [reviewAssignment, setReviewAssignment] = useState<{
    assignment: TaskAssignmentRow;
    task: Task;
  } | null>(null);
  /** Task whose priority popover is open. Stored on click of the priority
   *  badge cell — admin picks a new value inline without opening Edit. */
  const [priorityTask, setPriorityTask] = useState<Task | null>(null);

  // ── Server state ─────────────────────────────────────────────

  const filters = useMemo(
    () => ({
      ...(filterStatus && { status: filterStatus }),
      ...(filterPriority && { priority: filterPriority }),
      ...(filterTimeBucket && { timeBucket: filterTimeBucket }),
      ...(filterAssignmentStatus && { assignmentStatus: filterAssignmentStatus }),
      ...(filterAssignee && { assigneeId: filterAssignee }),
      ...(search.trim() && { search: search.trim() }),
      page,
      limit,
      sortBy,
      sortDir,
    }),
    [
      filterStatus,
      filterPriority,
      filterTimeBucket,
      filterAssignmentStatus,
      filterAssignee,
      search,
      page,
      limit,
      sortBy,
      sortDir,
    ],
  );

  const tasksQuery = useQuery({
    queryKey: qk.tasks.list(filters),
    queryFn: () => listTasksAdmin(filters),
  });
  const tasks = tasksQuery.data?.data ?? [];
  const pagination = tasksQuery.data?.pagination;

  const statsQuery = useQuery({
    queryKey: qk.tasks.stats(),
    queryFn: getAdminTaskStats,
    refetchInterval: 60_000,
  });
  const stats = statsQuery.data;

  // Load eligible employees once for assignee picker + filter dropdown
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    api
      .get<{ data: EmployeeOption[] }>("/users", {
        params: { status: "ACTIVE", limit: "500" },
      })
      .then((r) =>
        setEmployees(
          (r.data.data ?? []).filter(
            (u) => u.role === "RECRUITER" || u.role === "REPORTING_MANAGER",
          ),
        ),
      )
      .catch(() => {});
  }, []);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: qk.tasks.all() });
  };

  // ── Mutation handlers ────────────────────────────────────────

  const handleCreate = async (form: FormState) => {
    const parsed = createTaskSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return false;
    }
    try {
      await createTask(parsed.data);
      toast.success("Task created and assignees notified");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Failed to create task");
      return false;
    }
  };

  const handleUpdate = async (id: string, form: FormState) => {
    const parsed = createTaskSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return false;
    }
    try {
      await updateTask(id, {
        subject: parsed.data.subject,
        body: parsed.data.body,
        priority: parsed.data.priority,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });
      toast.success("Task updated");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Failed to update task");
      return false;
    }
  };

  const handleReassign = async (id: string, userIds: string[]) => {
    try {
      const result = await reassignTask(id, userIds);
      if (result.keptDueToProgress.length > 0) {
        toast.warning(
          `${result.keptDueToProgress.length} assignee(s) kept because they're past PENDING.`,
        );
      } else {
        toast.success("Task reassigned");
      }
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Reassign failed");
      return false;
    }
  };

  const handleExtend = async (id: string, newEndDate: string) => {
    try {
      await updateTask(id, { endDate: newEndDate });
      toast.success("Deadline extended — assignees notified");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Extend failed");
      return false;
    }
  };

  const handleCancel = async (id: string, reason: string) => {
    try {
      await cancelTask(id, reason);
      toast.success("Task cancelled");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Cancel failed");
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      toast.success("Task deleted");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Delete failed");
      return false;
    }
  };

  /**
   * §Task — inline change-priority quick action. Reuses the existing
   * PATCH /tasks/:id which accepts a partial body. Notifies via existing
   * audit pipeline; no separate notification (priority bumps are common
   * tweaks, not noteworthy events).
   */
  const handleChangePriority = async (id: string, priority: TaskPriority) => {
    try {
      await updateTask(id, { priority });
      toast.success("Priority updated");
      invalidateAll();
    } catch (err) {
      toast.error((err as Error).message || "Failed to change priority");
    }
  };

  const handleDecide = async (
    assignmentId: string,
    decision: "ACCEPTED" | "REJECTED",
    note: string,
  ) => {
    try {
      await decideAssignment(assignmentId, decision, note);
      toast.success(decision === "ACCEPTED" ? "Submission accepted" : "Submission rejected");
      invalidateAll();
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Failed to record decision");
      return false;
    }
  };

  // ── Columns ──────────────────────────────────────────────────

  const columns: Column<Task>[] = [
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      cell: (t) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setViewTask(t)}
            className="text-text-primary hover:text-primary-500 text-left font-medium"
          >
            {t.subject}
          </button>
          <p className="text-text-muted text-xs">
            {t.createdBy.firstName} {t.createdBy.lastName} •{" "}
            {new Date(t.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (t) => (
        // Click-to-change priority. Active tasks only — cancelled tasks
        // shouldn't be re-prioritised.
        <button
          type="button"
          onClick={() => t.status === "ACTIVE" && setPriorityTask(t)}
          className={t.status === "ACTIVE" ? "cursor-pointer" : "cursor-default"}
          title={t.status === "ACTIVE" ? "Click to change priority" : undefined}
        >
          <Badge variant={PRIORITY_VARIANT[t.priority]} size="sm">
            {t.priority}
          </Badge>
        </button>
      ),
    },
    {
      key: "assignees",
      header: "Assignees",
      cell: (t) => (
        <div className="flex items-center gap-1 text-sm">
          <Users size={12} className="text-text-muted" />
          <span className="text-text-primary">{t.assignments.length}</span>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      cell: (t) => {
        const { completionPercent, accepted, total, submitted } = t.progress;
        return (
          <div className="min-w-[160px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-primary font-medium">
                {accepted}/{total} done
              </span>
              <span className="text-text-muted">{completionPercent}%</span>
            </div>
            <Progress
              value={completionPercent}
              variant={
                completionPercent === 100 ? "success" : completionPercent >= 50 ? "primary" : "warning"
              }
              size="sm"
              className="mt-1"
            />
            {submitted > 0 && (
              <p className="text-info-500 mt-1 text-[10px] font-medium">
                {submitted} awaiting review
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "endDate",
      header: "Deadline",
      sortable: true,
      cell: (t) => {
        const date = new Date(t.endDate).toLocaleDateString("en-IN");
        let sub: { text: string; cls: string } | null = null;
        if (t.status === "CANCELLED") {
          sub = { text: "task cancelled", cls: "text-error-500" };
        } else if (t.isOverdue) {
          sub = { text: `overdue by ${Math.abs(t.daysUntilEnd)}d`, cls: "text-error-500" };
        } else if (t.daysUntilEnd <= 0) {
          sub = { text: "due today", cls: "text-warning-500" };
        } else if (t.daysUntilEnd <= 3) {
          sub = { text: `due in ${t.daysUntilEnd}d`, cls: "text-warning-500" };
        }
        return (
          <div>
            <div className="text-text-secondary text-sm">{date}</div>
            {sub && <p className={`text-xs ${sub.cls}`}>{sub.text}</p>}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <Badge variant={t.status === "ACTIVE" ? "success" : "default"}>
          {t.status === "ACTIVE" ? "Active" : "Cancelled"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <div className="flex gap-0.5">
          <Tooltip content="View detail">
            <IconButton
              icon={Eye}
              aria-label="View task"
              size="sm"
              variant="ghost"
              onClick={() => setViewTask(t)}
            />
          </Tooltip>
          {t.status === "ACTIVE" && (
            <>
              <Tooltip content="Edit">
                <IconButton
                  icon={Pencil}
                  aria-label="Edit task"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditTask(t)}
                />
              </Tooltip>
              <Tooltip content="Reassign">
                <IconButton
                  icon={Users}
                  aria-label="Reassign"
                  size="sm"
                  variant="ghost"
                  onClick={() => setReassignTaskState(t)}
                />
              </Tooltip>
              <Tooltip content="Extend deadline">
                <IconButton
                  icon={CalendarClock}
                  aria-label="Extend"
                  size="sm"
                  variant="ghost"
                  onClick={() => setExtendTask(t)}
                />
              </Tooltip>
              <Tooltip content="Cancel task">
                <IconButton
                  icon={XCircle}
                  aria-label="Cancel"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelTaskState(t)}
                />
              </Tooltip>
            </>
          )}
          <Tooltip content="View change history">
            <IconButton
              icon={HistoryIcon}
              aria-label="History"
              size="sm"
              variant="ghost"
              onClick={() => setHistoryTask(t)}
            />
          </Tooltip>
          <Tooltip content="Delete (soft)">
            <IconButton
              icon={Trash2}
              aria-label="Delete"
              size="sm"
              variant="danger"
              onClick={() => setDeleteTaskState(t)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Management"
        description="Assign tasks to recruiters and reporting managers, review submissions, track progress"
        actions={
          <Button leftIcon={Plus} onClick={() => setCreateOpen(true)}>
            New Task
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Tasks" value={stats?.total ?? 0} icon={CheckSquare} />
        <StatCard label="Awaiting Review" value={stats?.awaitingReview ?? 0} tone="info" icon={Eye} />
        <StatCard label="Pending" value={stats?.pending ?? 0} tone="default" icon={Clock} />
        <StatCard label="Accepted" value={stats?.accepted ?? 0} tone="success" icon={CheckCircle2} />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} tone="danger" icon={AlertTriangle} />
        <StatCard label="Due Soon" value={stats?.dueSoon ?? 0} tone="warning" icon={CalendarClock} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search
              size={14}
              className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by subject…"
              className="pl-8"
            />
          </div>
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => {
            setPage(1);
            setFilterStatus(e.target.value as "" | "ACTIVE" | "CANCELLED");
          }}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "", label: "All statuses" },
          ]}
        />
        <Select
          value={filterPriority}
          onChange={(e) => {
            setPage(1);
            setFilterPriority(e.target.value as "" | TaskPriority);
          }}
          options={[{ value: "", label: "All priorities" }, ...PRIORITY_OPTIONS]}
        />
        <Select
          value={filterTimeBucket}
          onChange={(e) => {
            setPage(1);
            setFilterTimeBucket(e.target.value as "" | TaskTimeBucket);
          }}
          options={[
            { value: "", label: "Any timing" },
            { value: "OVERDUE", label: "Overdue" },
            { value: "DUE_TODAY", label: "Due today" },
            { value: "DUE_SOON", label: "Due soon (≤3d)" },
            { value: "ON_TRACK", label: "On track" },
            { value: "NOT_STARTED", label: "Not started" },
          ]}
        />
        <Select
          value={filterAssignmentStatus}
          onChange={(e) => {
            setPage(1);
            setFilterAssignmentStatus(e.target.value as "" | TaskAssignmentStatus);
          }}
          options={[
            { value: "", label: "Any progress" },
            { value: "PENDING", label: "Has pending" },
            { value: "SUBMITTED", label: "Has submitted" },
            { value: "ACCEPTED", label: "Has accepted" },
            { value: "REJECTED", label: "Has rejected" },
          ]}
        />
        <Select
          value={filterAssignee}
          onChange={(e) => {
            setPage(1);
            setFilterAssignee(e.target.value);
          }}
          options={[
            { value: "", label: "All assignees" },
            ...employees.map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName}${e.employeeId ? ` (${e.employeeId})` : ""}`,
            })),
          ]}
        />
      </div>

      {/* Table */}
      <DataTable<Task>
        columns={columns}
        data={tasks}
        loading={tasksQuery.isLoading}
        emptyIcon={CheckSquare}
        emptyTitle="No tasks found"
        emptyDescription="Create the first task with the New Task button above"
        viewType={viewType}
        onViewTypeChange={setViewType}
        onSort={(key, dir) => {
          // DataTable's 3-state cycle returns null on the "unsorted" tick.
          // Fall back to the default (createdAt desc) when that happens.
          if (key === "subject" || key === "priority" || key === "endDate" || key === "createdAt") {
            if (dir === null) {
              setSortBy("createdAt");
              setSortDir("desc");
            } else {
              setSortBy(key);
              setSortDir(dir);
            }
          }
        }}
      />

      {/* Pagination strip */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-muted">
            Showing {tasks.length} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-text-secondary">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <Select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              options={[
                { value: "10", label: "10 / page" },
                { value: "25", label: "25 / page" },
                { value: "50", label: "50 / page" },
                { value: "100", label: "100 / page" },
              ]}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <CreateOrEditModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Task"
        initial={emptyForm}
        employees={employees}
        onSubmit={async (form) => {
          const ok = await handleCreate(form);
          if (ok) setCreateOpen(false);
        }}
      />

      <CreateOrEditModal
        open={editTask !== null}
        onClose={() => setEditTask(null)}
        title="Edit Task"
        initial={
          editTask
            ? {
                subject: editTask.subject,
                body: editTask.body,
                priority: editTask.priority,
                startDate: editTask.startDate.slice(0, 10),
                endDate: editTask.endDate.slice(0, 10),
                assigneeIds: editTask.assignments.map((a) => a.userId),
              }
            : emptyForm
        }
        employees={employees}
        hideAssignees
        onSubmit={async (form) => {
          if (!editTask) return;
          const ok = await handleUpdate(editTask.id, form);
          if (ok) setEditTask(null);
        }}
      />

      <ReassignModal
        task={reassignTaskState}
        employees={employees}
        onClose={() => setReassignTaskState(null)}
        onConfirm={async (ids) => {
          if (!reassignTaskState) return;
          const ok = await handleReassign(reassignTaskState.id, ids);
          if (ok) setReassignTaskState(null);
        }}
      />

      <ExtendModal
        task={extendTask}
        onClose={() => setExtendTask(null)}
        onConfirm={async (newDate) => {
          if (!extendTask) return;
          const ok = await handleExtend(extendTask.id, newDate);
          if (ok) setExtendTask(null);
        }}
      />

      <CancelModal
        task={cancelTaskState}
        onClose={() => setCancelTaskState(null)}
        onConfirm={async (reason) => {
          if (!cancelTaskState) return;
          const ok = await handleCancel(cancelTaskState.id, reason);
          if (ok) setCancelTaskState(null);
        }}
      />

      <ConfirmDialog
        open={deleteTaskState !== null}
        onClose={() => setDeleteTaskState(null)}
        onConfirm={async () => {
          if (!deleteTaskState) return;
          const ok = await handleDelete(deleteTaskState.id);
          if (ok) setDeleteTaskState(null);
        }}
        title="Delete Task"
        description={
          deleteTaskState
            ? `Permanently delete "${deleteTaskState.subject}"? This is a soft delete and can be restored from Trash.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />

      <TaskDetailModal
        task={viewTask}
        onClose={() => setViewTask(null)}
        onReview={(assignment, task) => {
          setViewTask(null);
          setReviewAssignment({ assignment, task });
        }}
      />

      <HistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />

      {/* §Task — inline Change Priority modal */}
      <ChangePriorityModal
        task={priorityTask}
        onClose={() => setPriorityTask(null)}
        onPick={async (p) => {
          if (!priorityTask) return;
          await handleChangePriority(priorityTask.id, p);
          setPriorityTask(null);
        }}
      />

      <ReviewModal
        review={reviewAssignment}
        onClose={() => setReviewAssignment(null)}
        onDecide={async (decision, note) => {
          if (!reviewAssignment) return;
          const ok = await handleDecide(reviewAssignment.assignment.id, decision, note);
          if (ok) setReviewAssignment(null);
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Sub-components — kept in same file because they're
//  tightly coupled to this page's data flow.
// ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof CheckSquare;
  tone?: "info" | "success" | "warning" | "danger" | "default";
}) {
  const toneClass =
    tone === "danger"
      ? "text-error-500"
      : tone === "warning"
        ? "text-warning-500"
        : tone === "success"
          ? "text-success-500"
          : tone === "info"
            ? "text-info-500"
            : "text-text-primary";
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div className="bg-bg-muted flex h-9 w-9 items-center justify-center rounded-md">
          <Icon size={16} className={toneClass} />
        </div>
        <div>
          <p className="text-text-muted text-xs">{label}</p>
          <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Create / Edit modal ────────────────────────────────────────

function CreateOrEditModal({
  open,
  onClose,
  title,
  initial,
  employees,
  onSubmit,
  hideAssignees,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: FormState;
  employees: EmployeeOption[];
  onSubmit: (form: FormState) => void | Promise<void>;
  hideAssignees?: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  // Reset form when initial changes (e.g. opening edit for a different task)
  useEffect(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.subject]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Subject" htmlFor="task-subject" required>
          <Input
            id="task-subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="e.g. Q2 candidate sourcing push"
            autoFocus
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField label="Priority" htmlFor="task-priority" required>
            <Select
              id="task-priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              options={PRIORITY_OPTIONS}
            />
          </FormField>
          <FormField label="Start Date" htmlFor="task-start" required>
            <DatePicker
              id="task-start"
              value={form.startDate}
              onChange={(v) => setForm({ ...form, startDate: v })}
            />
          </FormField>
          <FormField label="End Date" htmlFor="task-end" required>
            <DatePicker
              id="task-end"
              value={form.endDate}
              onChange={(v) => setForm({ ...form, endDate: v })}
            />
          </FormField>
        </div>

        {!hideAssignees && (
          <FormField label="Assign To" htmlFor="task-assignees" required>
            <AssigneeMultiPicker
              employees={employees}
              selectedIds={form.assigneeIds}
              onChange={(ids) => setForm({ ...form, assigneeIds: ids })}
            />
          </FormField>
        )}

        <FormField label="Task Description" required>
          <TiptapEditor
            content={form.body}
            onChange={(html) => setForm({ ...form, body: html })}
            charLimit={10_000}
            placeholder="Describe what needs to be done…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Assignee multi-picker ──────────────────────────────────────

function AssigneeMultiPicker({
  employees,
  selectedIds,
  onChange,
}: {
  employees: EmployeeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const selectedSet = new Set(selectedIds);
  const filtered = employees.filter(
    (e) =>
      !selectedSet.has(e.id) &&
      `${e.firstName} ${e.lastName} ${e.employeeId ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selectedEmployees = employees.filter((e) => selectedSet.has(e.id));

  const add = (id: string) => {
    onChange([...selectedIds, id]);
    setQuery("");
    // keep dropdown open so admin can pick multiple in a row
  };
  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div className="space-y-2" ref={ref}>
      {/* Selected chips */}
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEmployees.map((e) => (
            <span
              key={e.id}
              className="bg-bg-muted text-text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
            >
              <span className="font-medium">
                {e.firstName} {e.lastName}
              </span>
              {e.employeeId && <span className="text-text-muted">({e.employeeId})</span>}
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label="Remove assignee"
                className="text-text-muted hover:text-error-500"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div className="relative">
        <div className="relative">
          <Search
            size={14}
            className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              selectedEmployees.length === 0
                ? "Search recruiters / reporting managers…"
                : "Add more…"
            }
            className="pl-8"
          />
        </div>
        {open && (query || filtered.length > 0) && (
          <div className="border-border-default bg-bg-surface-raised absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border shadow-lg">
            {filtered.length === 0 ? (
              <div className="text-text-muted p-3 text-sm">No matches</div>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => add(e.id)}
                  className="hover:bg-bg-hover flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span className="text-text-primary">
                    {e.firstName} {e.lastName}
                  </span>
                  <span className="text-text-muted text-xs">
                    {e.role.replace("_", " ")} • {e.employeeId ?? "—"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reassign modal ─────────────────────────────────────────────

function ReassignModal({
  task,
  employees,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  employees: EmployeeOption[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void | Promise<void>;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (task) setIds(task.assignments.map((a) => a.userId));
  }, [task]);

  return (
    <Modal
      open={task !== null}
      onClose={onClose}
      title={task ? `Reassign — ${task.subject}` : "Reassign"}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(ids);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-text-muted text-sm">
          Assignees who have already submitted or been reviewed will be kept regardless of this list.
        </p>
        <AssigneeMultiPicker employees={employees} selectedIds={ids} onChange={setIds} />
      </div>
    </Modal>
  );
}

// ── Extend modal ──────────────────────────────────────────────

function ExtendModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  onClose: () => void;
  onConfirm: (newEnd: string) => void | Promise<void>;
}) {
  const [newEnd, setNewEnd] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (task) setNewEnd(task.endDate.slice(0, 10));
  }, [task]);
  if (!task) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Extend Deadline — ${task.subject}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              if (!newEnd) {
                toast.error("Pick a new end date");
                return;
              }
              setSaving(true);
              try {
                await onConfirm(newEnd);
              } finally {
                setSaving(false);
              }
            }}
          >
            Extend
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-text-secondary text-sm">
          Current deadline:{" "}
          <strong>{new Date(task.endDate).toLocaleDateString("en-IN")}</strong>
        </p>
        <FormField label="New End Date" htmlFor="extend-date">
          <DatePicker id="extend-date" value={newEnd} onChange={setNewEnd} />
        </FormField>
        <p className="text-text-muted text-xs">
          Assignees who haven't been accepted yet will be notified.
        </p>
      </div>
    </Modal>
  );
}

// ── Cancel modal ──────────────────────────────────────────────

function CancelModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (task) setReason("");
  }, [task]);
  if (!task) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel Task — ${task.subject}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep Task
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(reason);
              } finally {
                setSaving(false);
              }
            }}
            className="bg-error-500 hover:bg-error-700 text-white"
          >
            Cancel Task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-text-secondary text-sm">
          Cancelling sets the task to CANCELLED and notifies all assignees who haven't been
          accepted yet. The task remains in history.
        </p>
        <FormField label="Reason (optional)" htmlFor="cancel-reason">
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this task being cancelled?"
            rows={3}
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Task detail / progress modal ───────────────────────────────

function TaskDetailModal({
  task,
  onClose,
  onReview,
}: {
  task: Task | null;
  onClose: () => void;
  onReview: (a: TaskAssignmentRow, t: Task) => void;
}) {
  if (!task) return null;
  return (
    <Modal open onClose={onClose} title={task.subject} size="xl">
      <div className="space-y-4">
        {/* Header chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
          <Badge variant={task.status === "ACTIVE" ? "success" : "default"}>{task.status}</Badge>
          <span className="text-text-muted">
            {new Date(task.startDate).toLocaleDateString("en-IN")} →{" "}
            {new Date(task.endDate).toLocaleDateString("en-IN")}
          </span>
          <span className="text-text-muted">
            Created by {task.createdBy.firstName} {task.createdBy.lastName}
          </span>
        </div>
        {task.status === "CANCELLED" && task.cancelReason && (
          <div className="bg-error-50 dark:bg-error-950/30 rounded-md p-3 text-sm">
            <p className="text-error-700 dark:text-error-400 font-medium">Cancellation reason</p>
            <p className="text-error-600 dark:text-error-300 mt-1">{task.cancelReason}</p>
          </div>
        )}

        {/* Body */}
        <div>
          <p className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
            Description
          </p>
          <div
            className="border-border-default prose prose-sm max-w-none rounded-md border p-4"
            dangerouslySetInnerHTML={{ __html: task.body }}
          />
        </div>

        {/* Progress */}
        <div>
          <p className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
            Assignees ({task.progress.accepted}/{task.progress.total} accepted ·{" "}
            {task.progress.completionPercent}%)
          </p>
          <div className="border-border-default divide-border-default divide-y rounded-md border">
            {task.assignments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium">
                    {a.user.firstName} {a.user.lastName}
                  </p>
                  <p className="text-text-muted text-xs">
                    {a.user.role.replace("_", " ")} · {a.user.employeeId ?? "—"}
                  </p>
                  {a.submissionNote && (
                    <p className="text-text-secondary mt-1 text-xs italic">
                      "{a.submissionNote}"
                    </p>
                  )}
                  {a.decisionNote && (
                    <p
                      className={`mt-1 text-xs ${
                        a.status === "REJECTED" ? "text-error-500" : "text-success-500"
                      }`}
                    >
                      Decision: {a.decisionNote}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ASSIGNMENT_STATUS_VARIANT[a.status]} size="sm">
                    {a.status}
                  </Badge>
                  {a.submissionCount > 1 && (
                    <span className="text-text-muted text-[10px]">
                      ↻ {a.submissionCount} attempts
                    </span>
                  )}
                  {a.status === "SUBMITTED" && (
                    <Button size="sm" onClick={() => onReview(a, task)}>
                      Review
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Review (accept/reject) modal ───────────────────────────────

function ReviewModal({
  review,
  onClose,
  onDecide,
}: {
  review: { assignment: TaskAssignmentRow; task: Task } | null;
  onClose: () => void;
  onDecide: (decision: "ACCEPTED" | "REJECTED", note: string) => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<null | "ACCEPTED" | "REJECTED">(null);
  useEffect(() => {
    if (review) setNote("");
  }, [review]);
  if (!review) return null;
  const { assignment, task } = review;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Review — ${assignment.user.firstName}'s submission`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={saving === "REJECTED"}
            disabled={!!saving}
            onClick={async () => {
              if (!note.trim()) {
                toast.error("Rejection requires a note explaining why");
                return;
              }
              setSaving("REJECTED");
              try {
                await onDecide("REJECTED", note);
              } finally {
                setSaving(null);
              }
            }}
            className="bg-error-500 hover:bg-error-700 text-white"
          >
            <XOctagon size={14} className="mr-1" /> Reject
          </Button>
          <Button
            loading={saving === "ACCEPTED"}
            disabled={!!saving}
            onClick={async () => {
              setSaving("ACCEPTED");
              try {
                await onDecide("ACCEPTED", note);
              } finally {
                setSaving(null);
              }
            }}
            className="bg-success-500 hover:bg-success-700 text-white"
          >
            <CheckCircle2 size={14} className="mr-1" /> Accept
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="bg-bg-muted rounded-md p-3 text-sm">
          <p className="text-text-muted text-xs">Task</p>
          <p className="text-text-primary font-medium">{task.subject}</p>
        </div>
        {assignment.submissionNote && (
          <div>
            <p className="text-text-muted mb-1 text-xs">Employee's note</p>
            <p className="text-text-primary border-border-default rounded-md border p-3 text-sm italic">
              "{assignment.submissionNote}"
            </p>
          </div>
        )}
        <FormField
          label="Decision note"
          htmlFor="review-note"
          helpText="Required for rejection; optional for acceptance"
        >
          <Textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any feedback the employee should see…"
            rows={4}
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ── History modal ──────────────────────────────────────────────

const HISTORY_FIELD_LABEL: Record<string, string> = {
  subject: "Subject",
  body: "Description",
  priority: "Priority",
  startDate: "Start date",
  endDate: "End date",
  status: "Status",
  reason: "Reason",
  assigneeIds: "Assignees",
  added: "Added",
  removedCount: "Removed (count)",
  submissionNote: "Submission note",
  decisionNote: "Decision note",
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN");
  }
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function HistoryModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const historyQuery = useQuery({
    queryKey: qk.tasks.history(task?.id ?? "_none"),
    queryFn: async (): Promise<TaskHistoryEntry[]> => {
      if (!task) return [];
      return getTaskHistory(task.id);
    },
    enabled: task !== null,
  });
  if (!task) return null;
  const entries = historyQuery.data ?? [];
  return (
    <Modal open onClose={onClose} title={`History — ${task.subject}`} size="lg">
      {historyQuery.isLoading ? (
        <p className="text-text-muted text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center">
          <HistoryIcon size={28} className="text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">No history yet.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          <div className="bg-border-default absolute top-2 bottom-2 left-3 w-px" />
          {entries.map((e, i) => {
            const v =
              e.action === "CREATE"
                ? "success"
                : e.action === "DELETE"
                  ? "warning"
                  : "info";
            return (
              <div key={e.id} className="relative flex items-start gap-4 pb-5">
                <div
                  className={cn(
                    "ring-bg-surface relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2",
                    i === 0 ? "bg-primary-500" : "bg-border-default",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={v} size="sm">
                      {e.entityType === "TaskAssignment" ? `Assignment ${e.action}` : e.action}
                    </Badge>
                    <span className="text-text-muted text-xs">
                      {new Date(e.timestamp).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {e.user && (
                      <span className="text-text-muted text-xs">
                        by {e.user.firstName} {e.user.lastName}
                      </span>
                    )}
                  </div>
                  {e.changes && Object.keys(e.changes).length > 0 && (
                    <div className="border-border-default mt-2 space-y-1.5 rounded-md border p-3 text-xs">
                      {Object.entries(e.changes).map(([field, change]) => (
                        <div key={field} className="flex items-center gap-2">
                          <span className="text-text-muted w-28 shrink-0">
                            {HISTORY_FIELD_LABEL[field] ?? field}
                          </span>
                          <span className="text-text-secondary line-through">
                            {fmtValue(change.old)}
                          </span>
                          <ArrowRight size={11} className="text-text-muted shrink-0" />
                          <span className="text-text-primary font-medium">
                            {fmtValue(change.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Quick Change Priority modal ────────────────────────────────

function ChangePriorityModal({
  task,
  onClose,
  onPick,
}: {
  task: Task | null;
  onClose: () => void;
  onPick: (p: TaskPriority) => void | Promise<void>;
}) {
  const [saving, setSaving] = useState<TaskPriority | null>(null);
  if (!task) return null;
  return (
    <Modal open onClose={onClose} title={`Change Priority — ${task.subject}`} size="sm">
      <p className="text-text-secondary mb-3 text-sm">
        Currently <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRIORITY_OPTIONS.map((p) => (
          <Button
            key={p.value}
            variant={p.value === task.priority ? "primary" : "outline"}
            loading={saving === p.value}
            disabled={!!saving}
            onClick={async () => {
              if (p.value === task.priority) {
                onClose();
                return;
              }
              setSaving(p.value);
              try {
                await onPick(p.value);
              } finally {
                setSaving(null);
              }
            }}
          >
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                p.value === "LOW"
                  ? "bg-text-muted"
                  : p.value === "MEDIUM"
                    ? "bg-info-500"
                    : p.value === "HIGH"
                      ? "bg-warning-500"
                      : "bg-error-500"
              }`}
            />
            {p.label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}

// Silence unused-import warning from RotateCw which I expected to use
// for the resubmit row but ended up not (employees re-use the same flow).
void RotateCw;
