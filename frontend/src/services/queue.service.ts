import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Queue Dashboard Service — Admin-only
// ──────────────────────────────────────────────

export interface QueueStats {
  name: string;
  isPaused: boolean;
  counts: {
    active: number;
    completed: number;
    delayed: number;
    failed: number;
    waiting: number;
    paused: number;
  };
}

export async function getQueueStats(): Promise<QueueStats[]> {
  const res = await api.get<{ queues: QueueStats[] }>("/queues/stats");
  return res.data.queues;
}

export async function pauseQueue(name: string): Promise<void> {
  await api.post(`/queues/${name}/pause`);
}

export async function resumeQueue(name: string): Promise<void> {
  await api.post(`/queues/${name}/resume`);
}

export async function cleanQueue(name: string): Promise<{ completed: number; failed: number }> {
  const res = await api.post<{ removed: { completed: number; failed: number } }>(
    `/queues/${name}/clean`,
  );
  return res.data.removed;
}
