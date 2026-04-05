import { Router } from "express";
import {
  handleListHolidays,
  handleCreateHoliday,
  handleUpdateHoliday,
  handleDeleteHoliday,
} from "../controllers/holiday.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", handleListHolidays);
router.post("/", requireAdmin, handleCreateHoliday);
router.patch("/:id", requireAdmin, handleUpdateHoliday);
router.delete("/:id", requireAdmin, handleDeleteHoliday);

export { router as holidayRouter };
