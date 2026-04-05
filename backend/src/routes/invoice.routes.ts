import { Router } from "express";
import {
  handleListInvoices,
  handleGetInvoice,
  handleCreateInvoice,
  handleUpdateInvoice,
  handleDeleteInvoice,
  handleGetInvoiceStats,
} from "../controllers/invoice.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Invoice Routes — Gap #1
//  All routes require authentication + ADMIN role
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// Stats must come before /:id to avoid "stats" being parsed as an id
router.get("/stats", handleGetInvoiceStats);
router.get("/", handleListInvoices);
router.get("/:id", handleGetInvoice);
router.post("/", handleCreateInvoice);
router.patch("/:id", handleUpdateInvoice);
router.delete("/:id", handleDeleteInvoice);

export { router as invoiceRouter };
