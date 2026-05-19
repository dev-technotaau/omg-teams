import { Router } from "express";
import { analyticsRouter } from "./analytics.routes.js";
import { archiveRouter } from "./archive.routes.js";
import { attendanceRouter } from "./attendance.routes.js";
import { auditRouter } from "./audit.routes.js";
import { authRouter } from "./auth.routes.js";
import { bulkRouter } from "./bulk.routes.js";
import { candidateRouter } from "./candidate.routes.js";
import { companyRouter } from "./company.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { documentRouter } from "./document.routes.js";
import { draftRouter } from "./draft.routes.js";
import { dropdownRouter } from "./dropdown.routes.js";
import { duplicateRouter } from "./duplicate.routes.js";
import { emailTemplateRouter } from "./email-template.routes.js";
import { featureFlagRouter } from "./feature-flag.routes.js";
import { fileRouter } from "./file.routes.js";
import { holidayRouter } from "./holiday.routes.js";
import { importRouter } from "./import.routes.js";
import { invoiceRouter } from "./invoice.routes.js";
import { leaveRouter } from "./leave.routes.js";
import { notificationPreferenceRouter } from "./notification-preference.routes.js";
import { notificationRouter } from "./notification.routes.js";
import { offerLetterRouter } from "./offer-letter.routes.js";
import { presenceRouter } from "./presence.routes.js";
import { pushSubscriptionRouter } from "./push-subscription.routes.js";
import { queueApiRouter } from "./queue-dashboard.routes.js";
import { reportRouter } from "./report.routes.js";
import { searchRouter } from "./search.routes.js";
import { sessionAdminRouter } from "./session-admin.routes.js";
import { settingsRouter } from "./settings.routes.js";
import { targetRouter } from "./target.routes.js";
import { taskRouter } from "./task.routes.js";
import { trashRouter } from "./trash.routes.js";
import { uploadRouter } from "./upload.routes.js";
import { userRouter } from "./user.routes.js";
import { webauthnRouter } from "./webauthn.routes.js";
import { webhookRouter } from "./webhook.routes.js";
import { auditMiddleware } from "../middleware/audit.js";
import { roleRateLimit } from "../middleware/role-rate-limit.js";

// ──────────────────────────────────────────────
//  API v1 Router — /api/v1
// ──────────────────────────────────────────────

const router = Router();

// §16 — Per-role Redis-backed rate limiting (applied to all API routes)
router.use(roleRateLimit);

// §23.1 — Audit middleware: automatically logs all write operations
router.use(auditMiddleware);

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/companies", companyRouter);
router.use("/candidates", candidateRouter);
router.use("/dropdowns", dropdownRouter);
router.use("/drafts", draftRouter);
router.use("/duplicates", duplicateRouter);
router.use("/trash", trashRouter);
router.use("/bulk", bulkRouter);
router.use("/audit-logs", auditRouter);
router.use("/attendance", attendanceRouter);
router.use("/leaves", leaveRouter);
router.use("/documents", documentRouter);
router.use("/reports", reportRouter);
router.use("/notifications", notificationRouter);
router.use("/notification-preferences", notificationPreferenceRouter);
router.use("/settings", settingsRouter);
router.use("/holidays", holidayRouter);
router.use("/targets", targetRouter);
router.use("/tasks", taskRouter);
router.use("/offer-letters", offerLetterRouter);
router.use("/email-templates", emailTemplateRouter);
router.use("/search", searchRouter);
router.use("/analytics", analyticsRouter);
router.use("/import", importRouter);
router.use("/invoices", invoiceRouter);
router.use("/files", fileRouter);
router.use("/uploads", uploadRouter);
router.use("/dashboard", dashboardRouter);
router.use("/archive", archiveRouter);
router.use("/presence", presenceRouter);
router.use("/push-subscriptions", pushSubscriptionRouter);
router.use("/admin/sessions", sessionAdminRouter);
router.use("/feature-flags", featureFlagRouter);
router.use("/webauthn", webauthnRouter);
router.use("/webhooks", webhookRouter);
router.use("/queues", queueApiRouter);

export { router as apiRouter };
