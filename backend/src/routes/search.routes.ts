import { Router } from "express";
import { handleGlobalSearch } from "../controllers/search.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", handleGlobalSearch);

export { router as searchRouter };
