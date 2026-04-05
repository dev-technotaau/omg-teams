import * as archiveSvc from "../services/archive.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/archive — List archived records */
export async function handleListArchive(req: Request, res: Response): Promise<void> {
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 25;
  const entityType = req.query["entityType"] as string | undefined;
  const result = await archiveSvc.listArchivedRecords({ entityType, page, limit });
  res.status(200).json(result);
}

/** GET /api/v1/archive/stats — Archive summary stats */
export async function handleArchiveStats(_req: Request, res: Response): Promise<void> {
  const stats = await archiveSvc.getArchiveStats();
  res.status(200).json({ stats });
}

/** POST /api/v1/archive/:id/restore — Restore an archived record */
export async function handleRestoreArchive(req: Request, res: Response): Promise<void> {
  await archiveSvc.restoreArchivedRecord(req.params["id"] as string);
  res.status(200).json({ message: "Record restored" });
}

/** DELETE /api/v1/archive/:id — Permanently delete archived record */
export async function handleDeleteArchive(req: Request, res: Response): Promise<void> {
  await archiveSvc.deleteArchivedRecord(req.params["id"] as string);
  res.status(200).json({ message: "Record permanently deleted" });
}

/** POST /api/v1/archive/run — Manually trigger archiving */
export async function handleRunArchiving(_req: Request, res: Response): Promise<void> {
  const result = await archiveSvc.runArchiving();
  res.status(200).json(result);
}
