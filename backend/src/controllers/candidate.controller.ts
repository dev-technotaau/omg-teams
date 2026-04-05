import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import * as candidateSvc from "../services/candidate.service.js";
import { generateInvoiceNumber } from "../services/invoice.service.js";
import { maskCandidateRecord, maskCandidateRecords } from "../utils/pii-masking.js";
import type { Request, Response } from "express";

// ── Helpers ──

/**
 * Returns recruiter IDs assigned to a reporting manager.
 * Includes the manager's own ID.
 */
async function getTeamRecruiterIds(managerId: string): Promise<string[]> {
  const prisma = getPrisma();
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { managerId, removedAt: null },
    select: { recruiterId: true },
  });
  const ids = assignments.map((a) => a.recruiterId);
  ids.push(managerId);
  return ids;
}

/**
 * Verify the current user is allowed to view a specific candidate report.
 *  - ADMIN: always
 *  - REPORTING_MANAGER: if report belongs to a recruiter in their team
 *  - RECRUITER: only their own reports
 */
async function assertCanViewCandidate(req: Request, recruiterId: string): Promise<void> {
  const { role, id: userId } = req.user!;
  if (role === "ADMIN") return;
  if (role === "RECRUITER") {
    if (recruiterId !== userId) {
      throw new ForbiddenError("You can only view your own candidate reports");
    }
    return;
  }
  if (role === "REPORTING_MANAGER") {
    const teamIds = await getTeamRecruiterIds(userId);
    if (!teamIds.includes(recruiterId)) {
      throw new ForbiddenError("This candidate does not belong to your team");
    }
    return;
  }
  throw new ForbiddenError("You do not have permission to access this resource");
}

// ──────────────────────────────────────────────
//  Candidate Report Controller
// ──────────────────────────────────────────────

const zoneEnum = z.enum(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]);

const createSchema = z.object({
  zone: zoneEnum,
  dateSourced: z.string().optional(),
  candidateName: z.string().trim().min(1, "Candidate name is required"),
  contactNo: z.string().trim().min(1, "Contact number is required"),
  state: z.string().trim().optional(),
  location: z.string().trim().optional(),
  profile: z.string().trim().optional(),
  yearsOfExperience: z.number().optional(),
  currentCtc: z.number().optional(),
  currentDesignation: z.string().trim().optional(),
  currentOrganization: z.string().trim().optional(),
  emailId: z.string().trim().optional(),
  higherQualification: z.string().trim().optional(),
  expectedCtc: z.number().optional(),
  diplomaPartFull: z.string().trim().optional(),
  graduationPercent: z.number().optional(),
  graduationYear: z.number().int().optional(),
  twelfthPassingYear: z.number().int().optional(),
  twelfthPercent: z.number().optional(),
  tenthPassingYear: z.number().int().optional(),
  tenthPercent: z.number().optional(),
  dateOfBirth: z.string().optional(),
  noticePeriod: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  isCtcInformed: z.boolean().optional(),
  isOffRollOkay: z.boolean().optional(),
  isOnRollExplained: z.boolean().optional(),
  hasTwoWheeler: z.boolean().optional(),
  communicationSkill: z.number().int().min(1).max(10).optional(),
  status: z.string().trim().optional(),
});

/** POST /api/v1/candidates — Recruiter submits a new report */
export async function handleCreateCandidate(req: Request, res: Response): Promise<void> {
  // §24.9 — Recruiter daily submission limit (100 reports/day)
  if (req.user!.role === "RECRUITER") {
    const { getPrisma } = await import("../config/database.js");
    const prisma = getPrisma();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.candidateReport.count({
      where: { recruiterId: req.user!.id, createdAt: { gte: today }, deletedAt: null },
    });
    if (todayCount >= 100) {
      res.status(429).json({
        error: "Daily submission limit reached (100 reports/day). Try again tomorrow.",
        code: "RATE_LIMIT_EXCEEDED",
      });
      return;
    }
  }

  const body = createSchema.parse(req.body);
  const report = await candidateSvc.createCandidateReport({
    ...body,
    recruiterId: req.user!.id,
  });

  // GA4 server-side: track report submission
  void import("../utils/analytics.js").then(({ trackEvent: gaTrack }) =>
    gaTrack(req.user!.id, {
      name: "report_submitted",
      params: { candidate_name: body.candidateName },
    }),
  );

  // §24.10 — Emit report:submitted event for real-time dashboards
  try {
    const { emitReportSubmitted } = await import("../socket.js");
    emitReportSubmitted(req.user!.id, 1);
  } catch {
    /* socket not initialized — non-critical */
  }

  // §11.4 — Notify admins + RMs of report submission
  try {
    const { onReportSubmitted, onTargetAchieved } =
      await import("../services/notification-triggers.js");
    void onReportSubmitted(req.user!.id, 1);

    // Check if daily target achieved
    const { getPrisma: getDb } = await import("../config/database.js");
    const db = getDb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [dailyCount, activeTarget] = await Promise.all([
      db.candidateReport.count({
        where: { recruiterId: req.user!.id, createdAt: { gte: todayStart }, deletedAt: null },
      }),
      db.recruiterTarget.findFirst({
        where: { recruiterId: req.user!.id, targetType: "DAILY", isActive: true },
        select: { targetValue: true },
      }),
    ]);
    if (activeTarget && dailyCount >= activeTarget.targetValue) {
      void onTargetAchieved(req.user!.id, dailyCount);
    }
  } catch {
    /* non-critical */
  }

  res.status(201).json({ report });
}

/** GET /api/v1/candidates — List reports (scoped by role) */
export async function handleListCandidates(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: Parameters<typeof candidateSvc.listCandidateReports>[0] = {
    zone: q["zone"] as "NORTH" | "SOUTH" | "EAST" | "WEST" | "CENTRAL" | undefined,
    status: q["status"] as string | undefined,
    companyId: q["companyId"] as string | undefined,
    candidateStage: q["candidateStage"] as Parameters<
      typeof candidateSvc.listCandidateReports
    >[0]["candidateStage"],
    dateFrom: q["dateFrom"] as string | undefined,
    dateTo: q["dateTo"] as string | undefined,
    search: q["search"] as string | undefined,
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  };

  // Scope by role — recruiters see only their own, RMs see their team
  if (req.user!.role === "RECRUITER") {
    filters.recruiterId = req.user!.id;
  } else if (req.user!.role === "REPORTING_MANAGER") {
    filters.recruiterIds = await getTeamRecruiterIds(req.user!.id);
  }
  // ADMIN: no filter — sees all

  const result = await candidateSvc.listCandidateReports(filters);

  // §25.5 — PII masking for non-admin views
  if (result.data) {
    result.data = maskCandidateRecords(
      result.data as unknown as Record<string, unknown>[],
      req.user!.role,
      req.user!.id,
    ) as typeof result.data;
  }

  res.status(200).json(result);
}

/** GET /api/v1/candidates/export — Export candidates as XLSX (admin only) */
export async function handleExportCandidates(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: Parameters<typeof candidateSvc.exportCandidateReports>[0] = {
    search: q["search"] as string | undefined,
    dateFrom: q["dateFrom"] as string | undefined,
    dateTo: q["dateTo"] as string | undefined,
  };

  // Scope by role
  if (req.user!.role === "RECRUITER") {
    filters.recruiterId = req.user!.id;
  } else if (req.user!.role === "REPORTING_MANAGER") {
    filters.recruiterIds = await getTeamRecruiterIds(req.user!.id);
  }

  const buffer = await candidateSvc.exportCandidateReports(filters);
  const fileName = `candidates_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
}

/** GET /api/v1/candidates/:id — scoped by ownership */
export async function handleGetCandidate(req: Request, res: Response): Promise<void> {
  const report = await candidateSvc.getCandidateReport(req.params["id"] as string);
  await assertCanViewCandidate(req, report.recruiterId);

  // §25.5 — PII masking for non-admin views
  const masked = maskCandidateRecord(
    report as unknown as Record<string, unknown>,
    req.user!.role,
    req.user!.id,
  );
  res.status(200).json({ report: masked });
}

/** PATCH /api/v1/candidates/:id — Admin updates a report */
export async function handleUpdateCandidate(req: Request, res: Response): Promise<void> {
  const updateSchema = z
    .object({
      candidateName: z.string().optional(),
      contactNo: z.string().optional(),
      emailId: z.string().optional(),
      state: z.string().optional(),
      location: z.string().optional(),
      profile: z.string().optional(),
      qualification: z.string().optional(),
      yearsOfExperience: z.string().optional(),
      currentCtc: z.string().optional(),
      currentDesignation: z.string().optional(),
      currentOrganization: z.string().optional(),
      noticePeriod: z.string().optional(),
      currentStage: z.string().optional(),
      status: z.string().optional(),
      remarks: z.string().optional(),
      companyId: z.string().optional(),
      serviceProviderId: z.string().optional(),
      hrManagerId: z.string().optional(),
      adminLocation: z.string().optional(),
      adminState: z.string().optional(),
      dateOfJoining: z.string().optional(),
      invoiceDate: z.string().optional(),
      invoiceNumber: z.string().optional(),
      invoiceAmountTotal: z.number().optional(),
      gstAmount: z.number().optional(),
      amountReceived: z.number().optional(),
      tdsAmount: z.number().optional(),
      paymentStatus: z.string().optional(),
      paymentDate: z.string().optional(),
      cvSharedOnDate: z.string().optional(),
      hrFeedback: z.string().optional(),
      candidateStage: z.string().optional(),
    })
    .passthrough();

  const body = updateSchema.parse(req.body);
  const report = await candidateSvc.updateCandidateReport(
    req.params["id"] as string,
    body as candidateSvc.UpdateCandidateInput,
  );
  res.status(200).json({ report });
}

/** DELETE /api/v1/candidates/:id */
export async function handleDeleteCandidate(req: Request, res: Response): Promise<void> {
  await candidateSvc.deleteCandidateReport(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "Candidate report deleted" });
}

/** GET /api/v1/candidates/next-invoice — Get next invoice number */
export async function handleNextInvoice(_req: Request, res: Response): Promise<void> {
  const invoiceNumber = await generateInvoiceNumber();
  res.status(200).json({ invoiceNumber });
}

/** GET /api/v1/candidates/stats/by-recruiter?ids=a,b,c — Candidate stats per recruiter (RM/Admin) */
export async function handleStatsByRecruiter(req: Request, res: Response): Promise<void> {
  const { role, id: userId } = req.user!;
  const idsParam = req.query["ids"] as string | undefined;
  if (!idsParam) {
    res.status(400).json({ message: "ids query parameter is required" });
    return;
  }
  const recruiterIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // RECRUITER: can only query their own stats
  if (role === "RECRUITER") {
    if (recruiterIds.length !== 1 || recruiterIds[0] !== userId) {
      throw new ForbiddenError("You can only view your own stats");
    }
  }

  // REPORTING_MANAGER: can only query stats for their assigned team
  if (role === "REPORTING_MANAGER") {
    const teamIds = await getTeamRecruiterIds(userId);
    const unauthorized = recruiterIds.filter((id) => !teamIds.includes(id));
    if (unauthorized.length > 0) {
      throw new ForbiddenError("You can only view stats for recruiters in your team");
    }
  }

  // ADMIN: no restrictions

  const { getCandidateStatsByRecruiter } = await import("../services/dashboard.service.js");
  const stats = await getCandidateStatsByRecruiter(recruiterIds);
  res.status(200).json({ stats });
}
