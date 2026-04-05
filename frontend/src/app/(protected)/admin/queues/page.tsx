"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  getQueueStats,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  type QueueStats,
} from "@/services/queue.service";
import {
  PageHeader,
  Card,
  StatsCard,
  Button,
  Badge,
  ConfirmDialog,
  TableSkeleton,
} from "@/components/ui";

// ──────────────────────────────────────────────
//  BullMQ Queue Dashboard — Admin-only
// ──────────────────────────────────────────────

const QUEUE_DESCRIPTIONS: Record<string, string> = {
  email: "Transactional emails (OTP, password reset, notifications)",
  notification: "Push notifications, webhook deliveries, notification cleanup",
  storage: "File uploads, profile photo processing",
  archive: "Data archival, trash purge, attendance summaries, KYC reminders",
  "midnight-reset": "Daily attendance reset at midnight",
  "absent-detection": "Auto-detect absent employees",
  "session-expiry": "Cleanup expired sessions",
  "scheduled-report": "Scheduled report generation and delivery",
  backup: "Database backup jobs",
};

export default function QueueDashboardPage() {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleanTarget, setCleanTarget] = useState<string | null>(null);

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const stats = await getQueueStats();
      setQueues(stats);
    } catch {
      toast.error("Failed to load queue stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 15_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handlePauseResume = async (name: string, isPaused: boolean) => {
    try {
      if (isPaused) {
        await resumeQueue(name);
        toast.success(`Queue "${name}" resumed`);
      } else {
        await pauseQueue(name);
        toast.success(`Queue "${name}" paused`);
      }
      void fetchStats();
    } catch {
      toast.error("Operation failed");
    }
  };

  const handleClean = async () => {
    if (!cleanTarget) return;
    try {
      const removed = await cleanQueue(cleanTarget);
      toast.success(`Cleaned ${removed.completed} completed and ${removed.failed} failed jobs`);
      setCleanTarget(null);
      void fetchStats();
    } catch {
      toast.error("Failed to clean queue");
    }
  };

  // Aggregated totals
  const totals = queues.reduce(
    (acc, q) => ({
      active: acc.active + q.counts.active,
      waiting: acc.waiting + q.counts.waiting,
      completed: acc.completed + q.counts.completed,
      failed: acc.failed + q.counts.failed,
      delayed: acc.delayed + q.counts.delayed,
    }),
    { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Queue Dashboard"
          description="Monitor and manage background job queues"
        />
        <Button
          leftIcon={RefreshCw}
          variant="outline"
          size="sm"
          loading={refreshing}
          onClick={() => void fetchStats(true)}
        >
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatsCard icon={Activity} label="Active" value={totals.active} />
          <StatsCard icon={Clock} label="Waiting" value={totals.waiting} />
          <StatsCard icon={Timer} label="Delayed" value={totals.delayed} />
          <StatsCard icon={CheckCircle2} label="Completed" value={totals.completed} />
          <StatsCard icon={AlertTriangle} label="Failed" value={totals.failed} />
        </div>
      )}

      {/* Queue cards */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="space-y-3">
          {queues.map((q) => (
            <Card key={q.name}>
              <Card.Body>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-text-primary font-semibold capitalize">
                        {q.name.replace(/-/g, " ")}
                      </h3>
                      {q.isPaused && (
                        <Badge variant="warning" size="sm">
                          Paused
                        </Badge>
                      )}
                      {q.counts.failed > 0 && (
                        <Badge variant="danger" size="sm">
                          {q.counts.failed} failed
                        </Badge>
                      )}
                    </div>
                    <p className="text-text-muted mt-0.5 text-sm">
                      {QUEUE_DESCRIPTIONS[q.name] ?? "Background job queue"}
                    </p>
                  </div>

                  {/* Counters */}
                  <div className="flex items-center gap-3 text-sm">
                    <CounterBadge label="Active" count={q.counts.active} color="blue" />
                    <CounterBadge label="Waiting" count={q.counts.waiting} color="amber" />
                    <CounterBadge label="Delayed" count={q.counts.delayed} color="gray" />
                    <CounterBadge label="Done" count={q.counts.completed} color="green" />
                    <CounterBadge label="Failed" count={q.counts.failed} color="red" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handlePauseResume(q.name, q.isPaused)}
                      className="text-text-muted hover:text-primary-500 rounded p-1.5 transition-colors"
                      title={q.isPaused ? "Resume" : "Pause"}
                    >
                      {q.isPaused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button
                      onClick={() => setCleanTarget(q.name)}
                      className="text-text-muted hover:text-error-500 rounded p-1.5 transition-colors"
                      title="Clean completed/failed jobs"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Clean confirmation */}
      <ConfirmDialog
        open={!!cleanTarget}
        onClose={() => setCleanTarget(null)}
        onConfirm={() => void handleClean()}
        title={`Clean "${cleanTarget}" Queue`}
        description="This will remove all completed and failed jobs from the queue. Active and waiting jobs will not be affected."
        confirmLabel="Clean"
        variant="danger"
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Counter badge component
// ──────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "bg-info-50 text-info-700",
  amber: "bg-warning-50 text-warning-700",
  gray: "bg-bg-muted text-text-secondary",
  green: "bg-success-50 text-success-700",
  red: "bg-error-50 text-error-700",
};

function CounterBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${COLOR_MAP[color] ?? ""}`}>
      <span className="text-xs font-medium">{count}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}
