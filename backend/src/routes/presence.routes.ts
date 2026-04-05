import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getPresence, getBulkPresence } from "../services/presence.service.js";
import type { Request, Response } from "express";

const router = Router();
router.use(requireAuth);

/** GET /api/v1/presence/:userId — Get single user presence */
router.get("/:userId", async (req: Request, res: Response) => {
  const userId = req.params["userId"];
  if (typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const result = await getPresence(userId);
  res.status(200).json(result);
});

const bulkSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
});

/** POST /api/v1/presence/bulk — Get presence for multiple users */
router.post("/bulk", async (req: Request, res: Response) => {
  const { userIds } = bulkSchema.parse(req.body);
  const result = await getBulkPresence(userIds);
  res.status(200).json(result);
});

export { router as presenceRouter };
