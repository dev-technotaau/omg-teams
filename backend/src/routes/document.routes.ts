import { Router } from "express";
import {
  handleListDocTypes,
  handleMyDocuments,
  handleUploadDocument,
  handleListDocuments,
  handleVerifyDocument,
  handleRejectDocument,
  handleBatchVerify,
  handleBatchReject,
  handleKycStatus,
  handleListAllDocTypes,
  handleCreateDocType,
  handleUpdateDocType,
  handleDeleteDocType,
  handleViewDocument,
  handleChangeDocumentStatus,
} from "../controllers/document.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/types", handleListDocTypes);
router.get("/my", handleMyDocuments);
router.get("/kyc-status", requireAdmin, handleKycStatus);
router.post("/upload", handleUploadDocument);
router.post("/batch-verify", requireAdmin, handleBatchVerify);
router.post("/batch-reject", requireAdmin, handleBatchReject);
// Document type management (admin CRUD)
router.get("/types/all", requireAdmin, handleListAllDocTypes);
router.post("/types/manage", requireAdmin, handleCreateDocType);
router.patch("/types/manage/:id", requireAdmin, handleUpdateDocType);
router.delete("/types/manage/:id", requireAdmin, handleDeleteDocType);

router.get("/:id/view", handleViewDocument);
router.get("/", requireAdmin, handleListDocuments);
router.patch("/:id/verify", requireAdmin, handleVerifyDocument);
router.patch("/:id/reject", requireAdmin, handleRejectDocument);
router.patch("/:id/status", requireAdmin, handleChangeDocumentStatus);

export { router as documentRouter };
