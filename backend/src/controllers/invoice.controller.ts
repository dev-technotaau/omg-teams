import { z } from "zod";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import * as invoiceSvc from "../services/invoice.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Invoice Controller — Gap #1
// ──────────────────────────────────────────────

// ── Zod Schemas ──

const PaymentStatusEnum = z.enum(["UNPAID", "PARTIAL", "PAID", "OVERDUE"]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  paymentStatus: PaymentStatusEnum.optional(),
  candidateReportId: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

const createSchema = z.object({
  candidateReportId: z.string().min(1, "candidateReportId is required"),
  invoiceNumber: z.string().min(1).optional(),
  invoiceDate: z.string().date("invoiceDate must be a valid date (YYYY-MM-DD)"),
  amountTotal: z.number().positive("amountTotal must be positive"),
  gstAmount: z.number().min(0).nullable().optional(),
  tdsAmount: z.number().min(0).nullable().optional(),
  amountReceived: z.number().min(0).nullable().optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  paymentDate: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = z.object({
  invoiceDate: z.string().date().optional(),
  amountTotal: z.number().positive().optional(),
  gstAmount: z.number().min(0).nullable().optional(),
  tdsAmount: z.number().min(0).nullable().optional(),
  amountReceived: z.number().min(0).nullable().optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  paymentDate: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Handlers ──

export async function handleListInvoices(req: Request, res: Response): Promise<void> {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      {
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    );
  }
  const result = await invoiceSvc.listInvoices(parsed.data);
  res.status(200).json(result);
}

export async function handleGetInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceSvc.getInvoice(req.params["id"] as string);
  res.status(200).json({ data: invoice });
}

export async function handleCreateInvoice(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Invalid invoice data", HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, {
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const data = parsed.data;

  // Auto-generate invoice number if not provided
  const invoiceNumber = data.invoiceNumber ?? (await invoiceSvc.generateInvoiceNumber());

  const invoice = await invoiceSvc.createInvoice({
    ...data,
    invoiceNumber,
  });
  res.status(201).json({ data: invoice });
}

export async function handleUpdateInvoice(req: Request, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Invalid invoice data", HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, {
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const invoice = await invoiceSvc.updateInvoice(req.params["id"] as string, parsed.data);
  res.status(200).json({ data: invoice });
}

export async function handleDeleteInvoice(req: Request, res: Response): Promise<void> {
  const result = await invoiceSvc.deleteInvoice(req.params["id"] as string);
  res.status(200).json({ message: "Invoice deleted", data: result });
}

export async function handleGetInvoiceStats(_req: Request, res: Response): Promise<void> {
  const stats = await invoiceSvc.getInvoiceStats();
  res.status(200).json({ data: stats });
}
