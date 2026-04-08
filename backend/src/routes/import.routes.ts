import { Router } from "express";
import multer from "multer";
import {
  handleDownloadImportTemplate,
  handleExecuteImport,
  handleGetImportTemplate,
  handleGetLookups,
  handleParseXLSX,
  handlePreviewImport,
} from "../controllers/import.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { MAX_IMPORT_FILE_BYTES } from "../services/import.service.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// §23.6 — File upload for XLSX parsing (10 MB cap matches the spec)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_BYTES },
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

router.get("/lookups", handleGetLookups);
router.get("/template", handleGetImportTemplate);
router.get("/template/download", handleDownloadImportTemplate);
router.post("/parse-xlsx", upload.single("file"), handleParseXLSX);
router.post("/preview", handlePreviewImport);
router.post("/execute", handleExecuteImport);

export { router as importRouter };
