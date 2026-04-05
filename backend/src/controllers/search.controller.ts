import * as searchSvc from "../services/search.service.js";
import type { Request, Response } from "express";

export async function handleGlobalSearch(req: Request, res: Response): Promise<void> {
  const query = (req.query["q"] as string) ?? "";
  if (query.length < 2) {
    res.status(200).json({ results: {}, totalCount: 0 });
    return;
  }
  const typesParam = req.query["types"] ? (req.query["types"] as string).split(",") : undefined;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 5;
  const result = await searchSvc.globalSearch(query, req.user!.id, req.user!.role, {
    ...(typesParam !== undefined && { types: typesParam }),
    limit,
  });
  res.status(200).json(result);
}
