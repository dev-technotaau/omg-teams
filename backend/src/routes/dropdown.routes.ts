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
// POST is auth-only; the controller gates by category (only LOCATION + PROFILE
// can be created by non-admins, so the recruiter form's backfill flow works
// without exposing the whole master-data surface).
router.post("/", handleCreateDropdownOption);
router.patch("/:id", requireAdmin, handleUpdateDropdownOption);
router.delete("/:id", requireAdmin, handleDeleteDropdownOption);
router.post("/reorder", requireAdmin, handleReorderDropdownOptions);

export { router as dropdownRouter };
