import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Router } from "express";
import { createQueue } from "../config/queue.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  BullMQ Dashboard — Admin-only
//
//  Two interfaces:
//  1. /admin/queues — Bull Board UI (visual dashboard)
//  2. /api/v1/queues/stats — JSON API for custom frontend
// ──────────────────────────────────────────────

// Queue names matching all workers in src/jobs/
const QUEUE_NAMES = [
  "email",
  "notification",
  "storage",
  "archive",
  "midnight-reset",
  "absent-detection",
  "session-expiry",
  "scheduled-report",
  "database-backup",
  "candidate-import",
  "tor-list",
];

/** Create the Bull Board Express adapter (mounted separately in app.ts) */
export function createQueueDashboard(): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const queues = QUEUE_NAMES.map((name) => new BullMQAdapter(createQueue(name)));

  createBullBoard({
    queues,
    serverAdapter,
  });

  return serverAdapter;
}

// ──────────────────────────────────────────────
//  JSON API for custom frontend dashboard
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth, requireAdmin);

/** GET /queues/stats — Get all queue statistics */
router.get("/stats", async (_req, res) => {
  const stats = await Promise.all(
    QUEUE_NAMES.map(async (name) => {
      const queue = createQueue(name);
      const [counts, isPaused] = await Promise.all([
        queue.getJobCounts("active", "completed", "delayed", "failed", "waiting", "paused"),
        queue.isPaused(),
      ]);

      return {
        name,
        isPaused,
        counts,
      };
    }),
  );

  res.json({ queues: stats });
});

/** POST /queues/:name/pause — Pause a queue */
router.post("/:name/pause", async (req, res) => {
  const { name } = req.params;
  if (!QUEUE_NAMES.includes(name)) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const queue = createQueue(name);
  await queue.pause();
  res.json({ success: true, paused: true });
});

/** POST /queues/:name/resume — Resume a queue */
router.post("/:name/resume", async (req, res) => {
  const { name } = req.params;
  if (!QUEUE_NAMES.includes(name)) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const queue = createQueue(name);
  await queue.resume();
  res.json({ success: true, paused: false });
});

/** POST /queues/:name/clean — Clean completed/failed jobs */
router.post("/:name/clean", async (req, res) => {
  const { name } = req.params;
  if (!QUEUE_NAMES.includes(name)) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const queue = createQueue(name);
  const grace = 0; // remove all completed jobs
  const completedRemoved = await queue.clean(grace, 1000, "completed");
  const failedRemoved = await queue.clean(grace, 1000, "failed");
  res.json({
    success: true,
    removed: { completed: completedRemoved.length, failed: failedRemoved.length },
  });
});

export { router as queueApiRouter };
