import { Router } from "express";
import {
  handleListDropdownOptions,
  handleCreateDropdownOption,
  handleUpdateDropdownOption,
  handleDeleteDropdownOption,
  handleReorderDropdownOptions,
} from "../controllers/dropdown.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Dropdown Options Routes — /api/v1/dropdowns
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

router.get("/:category", handleListDropdownOptions);
router.post("/", requireAdmin, handleCreateDropdownOption);
router.patch("/:id", requireAdmin, handleUpdateDropdownOption);
router.delete("/:id", requireAdmin, handleDeleteDropdownOption);
router.post("/reorder", requireAdmin, handleReorderDropdownOptions);

export { router as dropdownRouter };
