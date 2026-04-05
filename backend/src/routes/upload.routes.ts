import { Router } from "express";
import {
  uploadProfilePhoto,
  uploadDocument,
  deleteProfilePhoto,
} from "../controllers/upload.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  avatarUpload,
  documentUpload,
  validateMagicBytes,
  scanForViruses,
  uploadRateLimit,
} from "../middleware/upload.js";

// ──────────────────────────────────────────────
//  Upload Routes — /api/v1/uploads
//  Pipeline: auth → multer → magic bytes → virus scan → rate limit → handler
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

// Full upload security pipeline: multer → magic bytes → virus scan → rate limit → handler
router.post(
  "/profile-photo",
  avatarUpload,
  validateMagicBytes,
  scanForViruses,
  uploadRateLimit,
  uploadProfilePhoto,
);
router.post(
  "/document",
  documentUpload,
  validateMagicBytes,
  scanForViruses,
  uploadRateLimit,
  uploadDocument,
);
router.delete("/profile-photo", deleteProfilePhoto);

// Admin: upload/delete photo for any user (§30.5)
router.post(
  "/profile-photo/:userId",
  requireAdmin,
  avatarUpload,
  validateMagicBytes,
  scanForViruses,
  uploadRateLimit,
  uploadProfilePhoto,
);
router.delete("/profile-photo/:userId", requireAdmin, deleteProfilePhoto);

// Admin: upload offer letter signature image
router.post(
  "/signature",
  requireAdmin,
  avatarUpload,
  validateMagicBytes,
  scanForViruses,
  async (req, res) => {
    const { uploadSignatureImage } = await import("../controllers/upload.controller.js");
    return uploadSignatureImage(req, res);
  },
);
router.delete("/signature", requireAdmin, async (req, res) => {
  const { deleteSignatureImage } = await import("../controllers/upload.controller.js");
  return deleteSignatureImage(req, res);
});

export { router as uploadRouter };
