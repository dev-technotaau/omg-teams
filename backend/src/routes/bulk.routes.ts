import { Router } from "express";
import {
  handleBulkStatus,
  handleBulkStage,
  handleBulkPaymentStatus,
  handleBulkDelete,
  handleBulkAssignCompany,
  handleBulkRestore,
} from "../controllers/bulk.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/status", handleBulkStatus);
router.post("/stage", handleBulkStage);
router.post("/payment-status", handleBulkPaymentStatus);
router.post("/delete", handleBulkDelete);
router.post("/assign-company", handleBulkAssignCompany);
router.post("/restore", handleBulkRestore);

export { router as bulkRouter };
