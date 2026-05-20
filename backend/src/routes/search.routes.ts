import { Router } from "express";
import { handleGlobalSearch } from "../controllers/search.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Admin-only. The service already role-scopes results (recruiter sees only
// their own candidates, RM sees their team), but cross-entity global search
// is an admin workflow and the page is now under /admin/search. Gate the
// endpoint too so direct API calls from non-admin sessions return 403.
router.get("/", requireAdmin, handleGlobalSearch);

export { router as searchRouter };
