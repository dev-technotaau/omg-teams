import { getPrisma } from "../config/database.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import type { PaymentStatus } from "@prisma/client";

// ──────────────────────────────────────────────
//  Invoice Service — Gap #1
// ──────────────────────────────────────────────

// ── Types ──

export interface InvoiceListFilters {
  page?: number | undefined;
  limit?: number | undefined;
  paymentStatus?: PaymentStatus | undefined;
  candidateReportId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface CreateInvoiceData {
  candidateReportId: string;
  invoiceNumber: string;
  invoiceDate: string;
  amountTotal: number;
  gstAmount?: number | null | undefined;
  tdsAmount?: number | null | undefined;
  amountReceived?: number | null | undefined;
  paymentStatus?: PaymentStatus | undefined;
  paymentDate?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface UpdateInvoiceData {
  invoiceNumber?: string | undefined;
  invoiceDate?: string | undefined;
  amountTotal?: number | undefined;
  gstAmount?: number | null | undefined;
  tdsAmount?: number | null | undefined;
  amountReceived?: number | null | undefined;
  paymentStatus?: PaymentStatus | undefined;
  paymentDate?: string | null | undefined;
  notes?: string | null | undefined;
}

// ── Invoice Number Auto-Generation ──
// Format: PREFIX-YYYYMMDD-NNN (e.g. HF-20260115-001)

/**
 * Generate next invoice number atomically.
 * §14 — Uses serializable transaction to prevent duplicate invoice numbers
 * from concurrent requests.
 */
export async function generateInvoiceNumber(): Promise<string> {
  const prisma = getPrisma();

  // Wrap in serializable transaction for concurrency safety (§14)
  return prisma.$transaction(
    async (tx) => {
      const [prefixSetting, dateFmtSetting, startSerialSetting] = await Promise.all([
        tx.platformSetting.findUnique({ where: { key: "invoice_prefix" } }),
        tx.platformSetting.findUnique({ where: { key: "invoice_date_format" } }),
        tx.platformSetting.findUnique({ where: { key: "invoice_starting_serial" } }),
      ]);
      const prefix = prefixSetting?.value ? String(prefixSetting.value) : "HF";
      const dateFmt = dateFmtSetting?.value ? String(dateFmtSetting.value) : "YYYYMMDD";
      const startSerial = startSerialSetting?.value ? Number(startSerialSetting.value) : 1;

      const now = new Date();
      const yyyy = now.getFullYear().toString();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const datePart =
        dateFmt === "DD/MM/YYYY"
          ? `${dd}${mm}${yyyy}`
          : dateFmt === "MM/DD/YYYY"
            ? `${mm}${dd}${yyyy}`
            : dateFmt === "YYYY-MM-DD"
              ? `${yyyy}${mm}${dd}`
              : `${yyyy}${mm}${dd}`;

      // Check both Invoice table and legacy CandidateReport invoiceNumber
      const [lastInvoice, lastLegacy] = await Promise.all([
        tx.invoice.findFirst({
          where: { invoiceNumber: { startsWith: `${prefix}-${datePart}-` } },
          orderBy: { invoiceNumber: "desc" },
          select: { invoiceNumber: true },
        }),
        tx.candidateReport.findFirst({
          where: {
            invoiceNumber: { startsWith: `${prefix}-${datePart}-` },
            deletedAt: null,
          },
          orderBy: { invoiceNumber: "desc" },
          select: { invoiceNumber: true },
        }),
      ]);

      let maxSerial = 0;
      for (const record of [lastInvoice, lastLegacy]) {
        if (record?.invoiceNumber) {
          const parts = record.invoiceNumber.split("-");
          const serialStr = parts[parts.length - 1];
          if (serialStr) {
            const serial = parseInt(serialStr, 10);
            if (serial > maxSerial) maxSerial = serial;
          }
        }
      }

      // Honor `invoice_starting_serial` only when there's no prior invoice
      // for today (otherwise we'd reset back below the latest one).
      const nextSerial = maxSerial > 0 ? maxSerial + 1 : Math.max(1, startSerial);
      const serialPart = nextSerial.toString().padStart(3, "0");
      return `${prefix}-${datePart}-${serialPart}`;
    },
    { isolationLevel: "Serializable" },
  );
}

// ── CRUD ──

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);

  const where: Record<string, unknown> = {};

  if (filters.paymentStatus) {
    where["paymentStatus"] = filters.paymentStatus;
  }
  if (filters.candidateReportId) {
    where["candidateReportId"] = filters.candidateReportId;
  }
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter["gte"] = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter["lte"] = new Date(filters.dateTo);
    where["invoiceDate"] = dateFilter;
  }

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { invoiceDate: "desc" },
      include: {
        candidateReport: {
          select: {
            id: true,
            candidateName: true,
            contactNo: true,
            companyId: true,
            company: { select: { id: true, companyName: true } },
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getInvoice(id: string) {
  const prisma = getPrisma();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      candidateReport: {
        select: {
          id: true,
          candidateName: true,
          contactNo: true,
          emailId: true,
          companyId: true,
          company: { select: { id: true, companyName: true } },
          recruiter: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("Invoice not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  return invoice;
}

export async function createInvoice(data: CreateInvoiceData) {
  const prisma = getPrisma();

  // Validate that the candidate report exists
  const report = await prisma.candidateReport.findUnique({
    where: { id: data.candidateReportId },
    select: { id: true, deletedAt: true },
  });

  if (!report || report.deletedAt) {
    throw new AppError(
      "Candidate report not found",
      HttpStatus.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
    );
  }

  // §14 — Cross-table duplicate check: check BOTH Invoice and CandidateReport tables
  const [existingInvoice, existingLegacy] = await Promise.all([
    prisma.invoice.findUnique({
      where: { invoiceNumber: data.invoiceNumber },
      select: { id: true },
    }),
    prisma.candidateReport.findFirst({
      where: {
        invoiceNumber: data.invoiceNumber,
        deletedAt: null,
        id: { not: data.candidateReportId }, // allow same candidate
      },
      select: { id: true },
    }),
  ]);

  if (existingInvoice) {
    throw new AppError(
      `Invoice number "${data.invoiceNumber}" already exists in invoices`,
      HttpStatus.CONFLICT,
      ErrorCode.DUPLICATE_ENTRY,
    );
  }
  if (existingLegacy) {
    throw new AppError(
      `Invoice number "${data.invoiceNumber}" already used by another candidate record`,
      HttpStatus.CONFLICT,
      ErrorCode.DUPLICATE_ENTRY,
    );
  }

  // §14 — Atomic: create Invoice AND sync invoiceNumber to CandidateReport
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        candidateReportId: data.candidateReportId,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date(data.invoiceDate),
        amountTotal: data.amountTotal,
        gstAmount: data.gstAmount ?? null,
        tdsAmount: data.tdsAmount ?? null,
        amountReceived: data.amountReceived ?? null,
        paymentStatus: data.paymentStatus ?? "UNPAID",
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        notes: data.notes ?? null,
      },
      include: {
        candidateReport: {
          select: { id: true, candidateName: true },
        },
      },
    });

    // Sync invoice number to CandidateReport for consistency
    await tx.candidateReport.update({
      where: { id: data.candidateReportId },
      data: { invoiceNumber: data.invoiceNumber },
    });

    return inv;
  });

  logger.info(`Invoice created: ${invoice.invoiceNumber} (id=${invoice.id})`);
  return invoice;
}

export async function updateInvoice(id: string, data: UpdateInvoiceData) {
  const prisma = getPrisma();

  // Check existence
  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, candidateReportId: true, invoiceNumber: true },
  });

  if (!existing) {
    throw new AppError("Invoice not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const updateData: Record<string, unknown> = {};

  // §14 — Allow invoiceNumber changes with cross-table validation
  if (data.invoiceNumber !== undefined && data.invoiceNumber !== existing.invoiceNumber) {
    const [dupInvoice, dupLegacy] = await Promise.all([
      prisma.invoice.findFirst({
        where: { invoiceNumber: data.invoiceNumber, id: { not: id } },
        select: { id: true },
      }),
      prisma.candidateReport.findFirst({
        where: {
          invoiceNumber: data.invoiceNumber,
          deletedAt: null,
          id: { not: existing.candidateReportId },
        },
        select: { id: true },
      }),
    ]);
    if (dupInvoice || dupLegacy) {
      throw new AppError(
        `Invoice number "${data.invoiceNumber}" is already in use`,
        HttpStatus.CONFLICT,
        ErrorCode.DUPLICATE_ENTRY,
      );
    }
    updateData["invoiceNumber"] = data.invoiceNumber;
  }

  if (data.invoiceDate !== undefined) updateData["invoiceDate"] = new Date(data.invoiceDate);
  if (data.amountTotal !== undefined) updateData["amountTotal"] = data.amountTotal;
  if (data.gstAmount !== undefined) updateData["gstAmount"] = data.gstAmount;
  if (data.tdsAmount !== undefined) updateData["tdsAmount"] = data.tdsAmount;
  if (data.amountReceived !== undefined) updateData["amountReceived"] = data.amountReceived;
  if (data.paymentStatus !== undefined) updateData["paymentStatus"] = data.paymentStatus;
  if (data.paymentDate !== undefined) {
    updateData["paymentDate"] = data.paymentDate ? new Date(data.paymentDate) : null;
  }
  if (data.notes !== undefined) updateData["notes"] = data.notes;

  // §14 — Sync invoiceNumber change to CandidateReport if changed
  if (updateData["invoiceNumber"] && existing.candidateReportId) {
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: { candidateReport: { select: { id: true, candidateName: true } } },
      });
      await tx.candidateReport.update({
        where: { id: existing.candidateReportId },
        data: { invoiceNumber: updateData["invoiceNumber"] as string },
      });
      return inv;
    });
    logger.info(`Invoice updated (with sync): ${invoice.invoiceNumber} (id=${invoice.id})`);
    return invoice;
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: {
      candidateReport: {
        select: { id: true, candidateName: true },
      },
    },
  });

  logger.info(`Invoice updated: ${invoice.invoiceNumber} (id=${invoice.id})`);
  return invoice;
}

export async function deleteInvoice(id: string) {
  const prisma = getPrisma();

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, invoiceNumber: true },
  });

  if (!existing) {
    throw new AppError("Invoice not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  await prisma.invoice.delete({ where: { id } });

  logger.info(`Invoice deleted: ${existing.invoiceNumber} (id=${id})`);
  return { id, invoiceNumber: existing.invoiceNumber };
}

export async function getInvoiceStats() {
  const prisma = getPrisma();

  const [statusAggregates, overallTotals] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["paymentStatus"],
      _count: { id: true },
      _sum: { amountTotal: true, amountReceived: true, gstAmount: true, tdsAmount: true },
    }),
    prisma.invoice.aggregate({
      _count: { id: true },
      _sum: { amountTotal: true, amountReceived: true, gstAmount: true, tdsAmount: true },
    }),
  ]);

  const byStatus = statusAggregates.map((row) => ({
    paymentStatus: row.paymentStatus,
    count: row._count.id,
    totalAmount: row._sum.amountTotal ?? 0,
    totalReceived: row._sum.amountReceived ?? 0,
    totalGst: row._sum.gstAmount ?? 0,
    totalTds: row._sum.tdsAmount ?? 0,
  }));

  return {
    overall: {
      count: overallTotals._count.id,
      totalAmount: overallTotals._sum.amountTotal ?? 0,
      totalReceived: overallTotals._sum.amountReceived ?? 0,
      totalGst: overallTotals._sum.gstAmount ?? 0,
      totalTds: overallTotals._sum.tdsAmount ?? 0,
      outstandingAmount:
        (overallTotals._sum.amountTotal ?? 0) - (overallTotals._sum.amountReceived ?? 0),
    },
    byStatus,
  };
}
