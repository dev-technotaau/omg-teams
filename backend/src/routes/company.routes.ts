import { Router } from "express";
import {
  handleCreateCompany,
  handleListCompanies,
  handleGetCompany,
  handleUpdateCompany,
  handleDeleteCompany,
  handleCreateServiceProvider,
  handleListServiceProviders,
  handleUpdateServiceProvider,
  handleDeleteServiceProvider,
  handleCreateHRManager,
  handleListHRManagers,
  handleUpdateHRManager,
  handleDeleteHRManager,
} from "../controllers/company.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Company / SP / HR Routes — /api/v1/companies
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

// Companies
router.get("/", handleListCompanies);
router.get("/:id", handleGetCompany);
router.post("/", requireAdmin, handleCreateCompany);
router.patch("/:id", requireAdmin, handleUpdateCompany);
router.delete("/:id", requireAdmin, handleDeleteCompany);

// Service Providers (nested under company)
router.get("/:companyId/service-providers", handleListServiceProviders);
router.post("/service-providers", requireAdmin, handleCreateServiceProvider);
router.patch("/service-providers/:id", requireAdmin, handleUpdateServiceProvider);
router.delete("/service-providers/:id", requireAdmin, handleDeleteServiceProvider);

// HR Managers (nested under company)
router.get("/:companyId/hr-managers", handleListHRManagers);
router.post("/hr-managers", requireAdmin, handleCreateHRManager);
router.patch("/hr-managers/:id", requireAdmin, handleUpdateHRManager);
router.delete("/hr-managers/:id", requireAdmin, handleDeleteHRManager);

export { router as companyRouter };
