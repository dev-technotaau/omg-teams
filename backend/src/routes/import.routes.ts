import { Router } from "express";
import multer from "multer";
import {
  handlePreviewImport,
  handleExecuteImport,
  handleGetImportTemplate,
  handleDownloadImportTemplate,
  handleParseXLSX,
} from "../controllers/import.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// §23.6 — File upload for XLSX parsing (10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only XLSX, XLS, and CSV files are allowed"));
    }
  },
});

router.post("/preview", handlePreviewImport);
router.post("/execute", handleExecuteImport);
router.get("/template", handleGetImportTemplate);
router.get("/template/download", handleDownloadImportTemplate);
router.post("/parse-xlsx", upload.single("file"), handleParseXLSX);

export { router as importRouter };
