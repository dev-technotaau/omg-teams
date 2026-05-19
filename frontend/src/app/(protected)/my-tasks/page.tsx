"use client";

// ──────────────────────────────────────────────
//  My Tasks — Recruiter / Reporting Manager view (§Task)
//
//  Shows tasks assigned to the current user with full detail and a
//  submit / resubmit workflow. URL ?taskId=... auto-opens that task's
//  detail (used by notification action URLs).
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XOctagon,
  Send,
  Search,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";
import {
  listMyTasks,
  submitTask,
  type MyTaskRow,
  type TaskAssignmentStatus,
  type TaskPriority,
  type TaskTimeBucket,
} from "@/services/task.service";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  FormField,
  Textarea,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const STATUS_VARIANT: Record<TaskAssignmentStatus, "default" | "info" | "warning" | "success" | "danger"> = {
  PENDING: "default",
  SUBMITTED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<TaskAssignmentStatus, string> = {
  PENDING: "To Do",
  SUBMITTED: "Awaiting Review",
  ACCEPTED: "Accepted",
  REJECTED: "Needs Revision",
};

const TIME_BUCKET_LABEL: Record<TaskTimeBucket, string> = {
  OVERDUE: "Overdue",
  DUE_TODAY: "Due Today",
  DUE_SOON: "Due Soon",
  ON_TRACK: "On Track",
  NOT_STARTED: "Not Started",
};

const TIME_BUCKET_VARIANT: Record<
  TaskTimeBucket,
  "default" | "info" | "warning" | "success" | "danger"
> = {
  OVERDUE: "danger",
  DUE_TODAY: "warning",
  DUE_SOON: "warning",
  ON_TRACK: "success",
  NOT_STARTED: "info",
};

/**
 * Live countdown shown on the open task card.
 * Returns a human-readable "2d 4h" / "3h 12m" / "Overdue by …" string.
 */
function useCountdown(endDateIso: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(endDateIso).getTime();
  const diff = end - now;
  if (diff <= 0) {
    const past = -diff;
    const days = Math.floor(past / (24 * 60 * 60 * 1000));
    const hours = Math.floor((past % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `Overdue by ${days}d ${hours}h`;
    return `Overdue by ${hours}h`;
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function MyTasksPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepLinkTaskId = searchParams.get("taskId");

  // Filters
  const [statusFilter, setStatusFilter] = useState<"" | TaskAssignmentStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | TaskPriority>("");
  const [timeFilter, setTimeFilter] = useState<"" | TaskTimeBucket>("");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
      ...(timeFilter && { timeBucket: timeFilter }),
      ...(search.trim() && { search: search.trim() }),
    }),
    [statusFilter, priorityFilter, timeFilter, search],
  );

  const tasksQuery = useQuery({
    queryKey: qk.tasks.myList(filters),
    queryFn: () => listMyTasks(filters),
    refetchInterval: 60_000,
  });
  const tasks = tasksQuery.data ?? [];

  const [selected, setSelected] = useState<MyTaskRow | null>(null);

  // Open the deep-linked task once data loads
  useEffect(() => {
    if (!deepLinkTaskId || !tasks.length) return;
    const found = tasks.find((t) => t.taskId === deepLinkTaskId);
    if (found && !selected) setSelected(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTaskId, tasks]);

  const closeDetail = () => {
    setSelected(null);
    // Drop the ?taskId= so the user doesn't get re-opened on refresh
    if (deepLinkTaskId) router.replace(pathname);
  };

  const groups = useMemo(() => {
    const open = tasks.filter((t) => t.status === "PENDING" || t.status === "REJECTED");
    const inReview = tasks.filter((t) => t.status === "SUBMITTED");
    const done = tasks.filter((t) => t.status === "ACCEPTED");
    return { open, inReview, done };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="Tasks assigned to you. Submit when complete, your admin will review."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="To Do"
          value={groups.open.length}
          tone={groups.open.some((t) => t.timeBucket === "OVERDUE") ? "danger" : "default"}
          icon={Clock}
        />
        <KpiCard label="Awaiting Review" value={groups.inReview.length} tone="info" icon={Send} />
        <KpiCard label="Accepted" value={groups.done.length} tone="success" icon={CheckCircle2} />
        <KpiCard
          label="Overdue"
          value={tasks.filter((t) => t.timeBucket === "OVERDUE").length}
          tone="danger"
          icon={AlertTriangle}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="relative">
          <Search size={14} className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | TaskAssignmentStatus)}
          options={[
            { value: "", label: "All statuses" },
            { value: "PENDING", label: "To Do" },
            { value: "SUBMITTED", label: "Awaiting Review" },
            { value: "ACCEPTED", label: "Accepted" },
            { value: "REJECTED", label: "Needs Revision" },
          ]}
        />
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as "" | TaskPriority)}
          options={[
            { value: "", label: "All priorities" },
            { value: "LOW", label: "Low" },
            { value: "MEDIUM", label: "Medium" },
            { value: "HIGH", label: "High" },
            { value: "URGENT", label: "Urgent" },
          ]}
        />
        <Select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as "" | TaskTimeBucket)}
          options={[
            { value: "", label: "Any timing" },
            { value: "OVERDUE", label: "Overdue" },
            { value: "DUE_TODAY", label: "Due today" },
            { value: "DUE_SOON", label: "Due soon (≤3d)" },
            { value: "ON_TRACK", label: "On track" },
            { value: "NOT_STARTED", label: "Not started" },
          ]}
        />
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks assigned"
          description="You don't have any tasks right now. Your admin will assign tasks here."
        />
      ) : (
        <div className="space-y-6">
          {groups.open.length > 0 && (
            <Section title="To Do" count={groups.open.length}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.open.map((t) => (
                  <TaskCard key={t.id} row={t} onOpen={() => setSelected(t)} />
                ))}
              </div>
            </Section>
          )}
          {groups.inReview.length > 0 && (
            <Section title="Awaiting Review" count={groups.inReview.length}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.inReview.map((t) => (
                  <TaskCard key={t.id} row={t} onOpen={() => setSelected(t)} />
                ))}
              </div>
            </Section>
          )}
          {groups.done.length > 0 && (
            <Section title="Accepted" count={groups.done.length}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.done.map((t) => (
                  <TaskCard key={t.id} row={t} onOpen={() => setSelected(t)} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      <TaskDetailDrawer
        row={selected}
        onClose={closeDetail}
        onSubmitted={() => {
          void qc.invalidateQueries({ queryKey: qk.tasks.all() });
          closeDetail();
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "default" | "info" | "success" | "danger" | "warning";
  icon: typeof CheckSquare;
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
        <div className="bg-bg-muted flex h-10 w-10 items-center justify-center rounded-md">
          <Icon size={18} className={toneClass} />
        </div>
        <div>
          <p className="text-text-muted text-xs">{label}</p>
          <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-text-primary text-sm font-semibold">{title}</h3>
        <span className="text-text-muted text-xs">{count}</span>
      </div>
      {children}
    </div>
  );
}

function TaskCard({ row, onOpen }: { row: MyTaskRow; onOpen: () => void }) {
  const countdown = useCountdown(row.task.endDate);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border-default bg-bg-surface hover:border-primary-500 group block w-full rounded-lg border p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-text-primary group-hover:text-primary-500 line-clamp-2 flex-1 font-semibold">
          {row.task.subject}
        </p>
        <Badge variant={PRIORITY_VARIANT[row.task.priority]} size="sm">
          {row.task.priority}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[row.status]} size="sm">
          {STATUS_LABEL[row.status]}
        </Badge>
        <Badge variant={TIME_BUCKET_VARIANT[row.timeBucket]} size="sm">
          {TIME_BUCKET_LABEL[row.timeBucket]}
        </Badge>
      </div>
      <p
        className={`mt-2 flex items-center gap-1 text-xs font-medium ${
          row.timeBucket === "OVERDUE"
            ? "text-error-500"
            : row.timeBucket === "DUE_TODAY" || row.timeBucket === "DUE_SOON"
              ? "text-warning-500"
              : "text-text-muted"
        }`}
      >
        <CalendarClock size={12} /> {countdown}
      </p>
      {row.status === "REJECTED" && row.decisionNote && (
        <p className="text-error-500 mt-2 line-clamp-2 text-xs">
          Rejected: {row.decisionNote}
        </p>
      )}
    </button>
  );
}

function TaskDetailDrawer({
  row,
  onClose,
  onSubmitted,
}: {
  row: MyTaskRow | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (row) setNote("");
  }, [row]);
  if (!row) return null;

  const canSubmit = row.status === "PENDING" || row.status === "REJECTED";
  const submitLabel = row.status === "REJECTED" ? "Resubmit" : "Mark Complete";

  const submit = async () => {
    setSaving(true);
    try {
      await submitTask(row.taskId, note);
      toast.success("Submitted — admin will review");
      onSubmitted();
    } catch (err) {
      toast.error((err as Error).message || "Submission failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={row.task.subject}
      size="xl"
      footer={
        canSubmit ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button leftIcon={Send} loading={saving} onClick={() => void submit()}>
              {submitLabel}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={PRIORITY_VARIANT[row.task.priority]}>{row.task.priority}</Badge>
          <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          <Badge variant={TIME_BUCKET_VARIANT[row.timeBucket]}>
            {TIME_BUCKET_LABEL[row.timeBucket]}
          </Badge>
          <span className="text-text-muted text-xs">
            {new Date(row.task.startDate).toLocaleDateString("en-IN")} →{" "}
            {new Date(row.task.endDate).toLocaleDateString("en-IN")}
          </span>
        </div>

        {/* Rejection feedback */}
        {row.status === "REJECTED" && row.decisionNote && (
          <div className="bg-error-50 dark:bg-error-950/30 rounded-md p-3">
            <p className="text-error-700 dark:text-error-400 flex items-center gap-2 text-sm font-medium">
              <XOctagon size={14} /> Previous submission rejected
            </p>
            <p className="text-error-600 dark:text-error-300 mt-1 text-sm">{row.decisionNote}</p>
            <p className="text-error-500 mt-1 text-xs">
              {row.decidedBy &&
                `by ${row.decidedBy.firstName} ${row.decidedBy.lastName}`}
              {row.decidedAt && ` · ${new Date(row.decidedAt).toLocaleString("en-IN")}`}
            </p>
          </div>
        )}

        {/* Acceptance feedback */}
        {row.status === "ACCEPTED" && (
          <div className="bg-success-50 dark:bg-success-950/30 rounded-md p-3">
            <p className="text-success-700 dark:text-success-400 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 size={14} /> Submission accepted
            </p>
            {row.decisionNote && (
              <p className="text-success-600 dark:text-success-300 mt-1 text-sm">
                {row.decisionNote}
              </p>
            )}
          </div>
        )}

        {/* Body */}
        <div>
          <p className="text-text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
            Description
          </p>
          <div
            className="border-border-default prose prose-sm max-w-none rounded-md border p-4"
            dangerouslySetInnerHTML={{ __html: row.task.body }}
          />
        </div>

        {/* Submit area (only for actionable states) */}
        {canSubmit && (
          <div>
            <FormField label="Note (optional)" htmlFor="submit-note">
              <Textarea
                id="submit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any context for the admin reviewing your work…"
                rows={3}
              />
            </FormField>
          </div>
        )}

        {row.status === "SUBMITTED" && row.submissionNote && (
          <div>
            <p className="text-text-muted mb-1 text-xs">Your submission note</p>
            <p className="text-text-primary border-border-default rounded-md border p-3 text-sm italic">
              "{row.submissionNote}"
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
