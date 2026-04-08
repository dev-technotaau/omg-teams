import { createQueue } from "../config/queue.js";
import type { ImportRow, ImportOptions } from "../services/import.service.js";

// ──────────────────────────────────────────────
//  Async Import Queue — Spec Section 23.6
//
//  For files above ASYNC_IMPORT_THRESHOLD rows we
//  enqueue the executeImport call so the request
//  doesn't block the HTTP thread. The admin gets
//  a notification when the worker finishes.
// ──────────────────────────────────────────────

export const importQueue = createQueue("candidate-import");

export interface AsyncImportJob {
  rows: ImportRow[];
  options: ImportOptions;
  importingUserId: string;
}

export async function enqueueAsyncImport(job: AsyncImportJob): Promise<string> {
  const queued = await importQueue.add("execute-import", job, {
    // Don't retry on failure — partial imports should be inspected,
    // not blindly retried (we already commit per-batch transactions).
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });
  return String(queued.id);
}
