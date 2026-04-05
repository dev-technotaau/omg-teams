import { type Zone, type CandidateStage, type Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { NotFoundError } from "../exceptions/not-found-error.js";

// ──────────────────────────────────────────────
//  Candidate Report Service
//  Spec Section 5, 6, 8
// ──────────────────────────────────────────────

/** Convert undefined → null for Prisma */
function n<T>(v: T | undefined): T | null {
  return v ?? null;
}

/** Zone-to-set mapping: Set A = West/Central, Set B = East/North/South */
function isSetA(zone: Zone): boolean {
  return zone === "WEST" || zone === "CENTRAL";
}

export interface CreateCandidateInput {
  recruiterId: string;
  zone: Zone;
  dateSourced?: string | undefined;
  candidateName?: string | undefined;
  contactNo?: string | undefined;
  state?: string | undefined;
  location?: string | undefined;
  profile?: string | undefined;
  yearsOfExperience?: number | undefined;
  currentCtc?: number | undefined;
  currentDesignation?: string | undefined;
  currentOrganization?: string | undefined;
  emailId?: string | undefined;
  higherQualification?: string | undefined;
  expectedCtc?: number | undefined;
  diplomaPartFull?: string | undefined;
  graduationPercent?: number | undefined;
  graduationYear?: number | undefined;
  twelfthPassingYear?: number | undefined;
  twelfthPercent?: number | undefined;
  tenthPassingYear?: number | undefined;
  tenthPercent?: number | undefined;
  dateOfBirth?: string | undefined;
  noticePeriod?: string | undefined;
  remarks?: string | undefined;
  // Zone-conditional (Set A only)
  isCtcInformed?: boolean | undefined;
  isOffRollOkay?: boolean | undefined;
  isOnRollExplained?: boolean | undefined;
  hasTwoWheeler?: boolean | undefined;
  communicationSkill?: number | undefined;
  status?: string | undefined;
}

export async function createCandidateReport(input: CreateCandidateInput) {
  const prisma = getPrisma();
  const setA = isSetA(input.zone);

  return prisma.candidateReport.create({
    data: {
      recruiterId: input.recruiterId,
      zone: input.zone,
      dateSourced: input.dateSourced ? new Date(input.dateSourced) : null,
      candidateName: n(input.candidateName),
      contactNo: n(input.contactNo),
      state: n(input.state),
      location: n(input.location),
      profile: n(input.profile),
      yearsOfExperience: n(input.yearsOfExperience),
      currentCtc: n(input.currentCtc),
      currentDesignation: n(input.currentDesignation),
      currentOrganization: n(input.currentOrganization),
      emailId: n(input.emailId),
      higherQualification: n(input.higherQualification),
      expectedCtc: n(input.expectedCtc),
      diplomaPartFull: n(input.diplomaPartFull),
      graduationPercent: n(input.graduationPercent),
      graduationYear: n(input.graduationYear),
      twelfthPassingYear: n(input.twelfthPassingYear),
      twelfthPercent: n(input.twelfthPercent),
      tenthPassingYear: n(input.tenthPassingYear),
      tenthPercent: n(input.tenthPercent),
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      noticePeriod: n(input.noticePeriod),
      remarks: n(input.remarks),
      // Zone-conditional: only store for Set A, null for Set B
      isCtcInformed: setA ? n(input.isCtcInformed) : null,
      isOffRollOkay: setA ? n(input.isOffRollOkay) : null,
      isOnRollExplained: setA ? n(input.isOnRollExplained) : null,
      hasTwoWheeler: setA ? n(input.hasTwoWheeler) : null,
      communicationSkill: setA ? n(input.communicationSkill) : null,
      status: input.status ?? "PENDING",
    },
  });
}

export interface UpdateCandidateInput extends Partial<CreateCandidateInput> {
  // Admin-only fields (34-48)
  companyId?: string | undefined;
  serviceProviderId?: string | undefined;
  hrManagerId?: string | undefined;
  adminLocation?: string | undefined;
  adminState?: string | undefined;
  dateOfJoining?: string | undefined;
  invoiceDate?: string | undefined;
  invoiceNumber?: string | undefined;
  invoiceAmountTotal?: number | undefined;
  gstAmount?: number | undefined;
  amountReceived?: number | undefined;
  tdsAmount?: number | undefined;
  paymentStatus?: string | undefined;
  paymentDate?: string | undefined;
  cvSharedOnDate?: string | undefined;
  hrFeedback?: string | undefined;
  candidateStage?: CandidateStage | undefined;
}

export async function updateCandidateReport(id: string, input: UpdateCandidateInput) {
  const prisma = getPrisma();

  const data: Prisma.CandidateReportUpdateInput = {};

  // Recruiter fields
  if (input.candidateName !== undefined) data.candidateName = n(input.candidateName);
  if (input.contactNo !== undefined) data.contactNo = n(input.contactNo);
  if (input.state !== undefined) data.state = n(input.state);
  if (input.location !== undefined) data.location = n(input.location);
  if (input.profile !== undefined) data.profile = n(input.profile);
  if (input.yearsOfExperience !== undefined) data.yearsOfExperience = n(input.yearsOfExperience);
  if (input.currentCtc !== undefined) data.currentCtc = n(input.currentCtc);
  if (input.currentDesignation !== undefined) data.currentDesignation = n(input.currentDesignation);
  if (input.currentOrganization !== undefined)
    data.currentOrganization = n(input.currentOrganization);
  if (input.emailId !== undefined) data.emailId = n(input.emailId);
  if (input.higherQualification !== undefined)
    data.higherQualification = n(input.higherQualification);
  if (input.expectedCtc !== undefined) data.expectedCtc = n(input.expectedCtc);
  if (input.diplomaPartFull !== undefined) data.diplomaPartFull = n(input.diplomaPartFull);
  if (input.graduationPercent !== undefined) data.graduationPercent = n(input.graduationPercent);
  if (input.graduationYear !== undefined) data.graduationYear = n(input.graduationYear);
  if (input.twelfthPassingYear !== undefined) data.twelfthPassingYear = n(input.twelfthPassingYear);
  if (input.twelfthPercent !== undefined) data.twelfthPercent = n(input.twelfthPercent);
  if (input.tenthPassingYear !== undefined) data.tenthPassingYear = n(input.tenthPassingYear);
  if (input.tenthPercent !== undefined) data.tenthPercent = n(input.tenthPercent);
  if (input.dateOfBirth !== undefined)
    data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.dateSourced !== undefined)
    data.dateSourced = input.dateSourced ? new Date(input.dateSourced) : null;
  if (input.noticePeriod !== undefined) data.noticePeriod = n(input.noticePeriod);
  if (input.remarks !== undefined) data.remarks = n(input.remarks);
  if (input.status !== undefined) data.status = n(input.status);

  // Zone-conditional
  if (input.isCtcInformed !== undefined) data.isCtcInformed = n(input.isCtcInformed);
  if (input.isOffRollOkay !== undefined) data.isOffRollOkay = n(input.isOffRollOkay);
  if (input.isOnRollExplained !== undefined) data.isOnRollExplained = n(input.isOnRollExplained);
  if (input.hasTwoWheeler !== undefined) data.hasTwoWheeler = n(input.hasTwoWheeler);
  if (input.communicationSkill !== undefined) data.communicationSkill = n(input.communicationSkill);

  // Admin-only fields
  if (input.companyId !== undefined)
    data.company = input.companyId ? { connect: { id: input.companyId } } : { disconnect: true };
  if (input.serviceProviderId !== undefined)
    data.serviceProvider = input.serviceProviderId
      ? { connect: { id: input.serviceProviderId } }
      : { disconnect: true };
  if (input.hrManagerId !== undefined)
    data.hrManager = input.hrManagerId
      ? { connect: { id: input.hrManagerId } }
      : { disconnect: true };
  if (input.adminLocation !== undefined) data.adminLocation = n(input.adminLocation);
  if (input.adminState !== undefined) data.adminState = n(input.adminState);
  if (input.dateOfJoining !== undefined)
    data.dateOfJoining = input.dateOfJoining ? new Date(input.dateOfJoining) : null;
  if (input.invoiceDate !== undefined)
    data.invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : null;
  if (input.invoiceNumber !== undefined) {
    // §14 — Cross-table duplicate check: verify not already used in Invoice table
    if (input.invoiceNumber) {
      const existingInvoice = await prisma.invoice.findUnique({
        where: { invoiceNumber: input.invoiceNumber },
        select: { id: true, candidateReportId: true },
      });
      if (existingInvoice && existingInvoice.candidateReportId !== id) {
        throw new (await import("../exceptions/conflict-error.js")).ConflictError(
          `Invoice number "${input.invoiceNumber}" is already used by another record`,
        );
      }
    }
    data.invoiceNumber = n(input.invoiceNumber);
  }
  if (input.invoiceAmountTotal !== undefined) data.invoiceAmountTotal = n(input.invoiceAmountTotal);
  if (input.gstAmount !== undefined) data.gstAmount = n(input.gstAmount);
  if (input.amountReceived !== undefined) data.amountReceived = n(input.amountReceived);
  if (input.tdsAmount !== undefined) data.tdsAmount = n(input.tdsAmount);
  if (input.paymentStatus !== undefined)
    data.paymentStatus =
      (input.paymentStatus as Prisma.NullableEnumPaymentStatusFieldUpdateOperationsInput["set"]) ??
      null;
  if (input.paymentDate !== undefined)
    data.paymentDate = input.paymentDate ? new Date(input.paymentDate) : null;
  if (input.cvSharedOnDate !== undefined)
    data.cvSharedOnDate = input.cvSharedOnDate ? new Date(input.cvSharedOnDate) : null;
  if (input.hrFeedback !== undefined)
    data.hrFeedback =
      (input.hrFeedback as Prisma.NullableEnumHRFeedbackFieldUpdateOperationsInput["set"]) ?? null;
  if (input.candidateStage !== undefined) data.candidateStage = input.candidateStage;

  return prisma.candidateReport.update({ where: { id }, data });
}

export async function getCandidateReport(id: string) {
  const prisma = getPrisma();
  const report = await prisma.candidateReport.findFirst({
    where: { id, deletedAt: null },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      company: { select: { id: true, name: true } },
      serviceProvider: { select: { id: true, name: true } },
      hrManager: { select: { id: true, name: true } },
    },
  });
  if (!report) throw new NotFoundError("Candidate Report", id);
  return report;
}

export async function listCandidateReports(filters: {
  recruiterId?: string | undefined;
  recruiterIds?: string[] | undefined;
  zone?: Zone | undefined;
  status?: string | undefined;
  companyId?: string | undefined;
  candidateStage?: CandidateStage | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.CandidateReportWhereInput = { deletedAt: null };

  if (filters.recruiterId) where.recruiterId = filters.recruiterId;
  else if (filters.recruiterIds) where.recruiterId = { in: filters.recruiterIds };
  if (filters.zone) where.zone = filters.zone;
  if (filters.status) where.status = filters.status;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.candidateStage) where.candidateStage = filters.candidateStage;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters.search) {
    where.OR = [
      { candidateName: { contains: filters.search, mode: "insensitive" } },
      { contactNo: { contains: filters.search } },
      { emailId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.candidateReport.findMany({
      where,
      include: {
        recruiter: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.candidateReport.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function exportCandidateReports(filters: {
  recruiterId?: string | undefined;
  recruiterIds?: string[] | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}): Promise<Buffer> {
  const prisma = getPrisma();

  const where: Prisma.CandidateReportWhereInput = { deletedAt: null };

  if (filters.recruiterId) where.recruiterId = filters.recruiterId;
  else if (filters.recruiterIds) where.recruiterId = { in: filters.recruiterIds };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters.search) {
    where.OR = [
      { candidateName: { contains: filters.search, mode: "insensitive" } },
      { contactNo: { contains: filters.search } },
      { emailId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const reports = await prisma.candidateReport.findMany({
    where,
    include: {
      recruiter: { select: { firstName: true, lastName: true, employeeId: true } },
      company: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMG Teams";
  const sheet = workbook.addWorksheet("Candidate Reports");

  sheet.columns = [
    { header: "Date Sourced", key: "dateSourced", width: 14 },
    { header: "Candidate Name", key: "candidateName", width: 25 },
    { header: "Contact No", key: "contactNo", width: 16 },
    { header: "Email", key: "emailId", width: 28 },
    { header: "Zone", key: "zone", width: 10 },
    { header: "State", key: "state", width: 16 },
    { header: "Location", key: "location", width: 16 },
    { header: "Profile", key: "profile", width: 20 },
    { header: "Company", key: "company", width: 22 },
    { header: "Stage", key: "candidateStage", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Recruiter", key: "recruiter", width: 22 },
    { header: "Recruiter ID", key: "recruiterId", width: 14 },
    { header: "Current CTC", key: "currentCtc", width: 14 },
    { header: "Expected CTC", key: "expectedCtc", width: 14 },
    { header: "Experience (yrs)", key: "yearsOfExperience", width: 14 },
    { header: "Notice Period", key: "noticePeriod", width: 14 },
    { header: "Remarks", key: "remarks", width: 30 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style the header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  for (const r of reports) {
    sheet.addRow({
      dateSourced: r.dateSourced ? new Date(r.dateSourced).toLocaleDateString() : "",
      candidateName: r.candidateName,
      contactNo: r.contactNo,
      emailId: r.emailId ?? "",
      zone: r.zone,
      state: r.state ?? "",
      location: r.location ?? "",
      profile: r.profile ?? "",
      company: r.company?.name ?? "",
      candidateStage: r.candidateStage,
      status: r.status,
      recruiter: r.recruiter ? `${r.recruiter.firstName} ${r.recruiter.lastName}` : "",
      recruiterId: r.recruiter?.employeeId ?? "",
      currentCtc: r.currentCtc ?? "",
      expectedCtc: r.expectedCtc ?? "",
      yearsOfExperience: r.yearsOfExperience ?? "",
      noticePeriod: r.noticePeriod ?? "",
      remarks: r.remarks ?? "",
      createdAt: r.createdAt.toISOString(),
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function deleteCandidateReport(id: string, deletedBy: string) {
  const prisma = getPrisma();
  return prisma.candidateReport.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
}
