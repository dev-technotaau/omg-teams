import { z } from "zod";
import * as docSvc from "../services/document.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/documents/types */
export async function handleListDocTypes(_req: Request, res: Response): Promise<void> {
  const types = await docSvc.listDocumentTypes();
  res.status(200).json({ types });
}

/** GET /api/v1/documents/my */
export async function handleMyDocuments(req: Request, res: Response): Promise<void> {
  const docs = await docSvc.getUserDocuments(req.user!.id);
  res.status(200).json({ documents: docs });
}

/** POST /api/v1/documents/upload */
export async function handleUploadDocument(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      documentTypeId: z.string(),
      fileUrl: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      storageKey: z.string(),
      storageBackend: z.enum(["CLOUDINARY", "R2"]).optional(),
      fileHash: z.string().optional(),
    })
    .parse(req.body);

  const doc = await docSvc.uploadDocument({ ...body, userId: req.user!.id });
  res.status(201).json({ document: doc });
}

/** GET /api/v1/documents — Admin: all documents */
export async function handleListDocuments(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const result = await docSvc.listAllDocuments({
    status: q["status"] as Parameters<typeof docSvc.listAllDocuments>[0]["status"],
    userId: q["userId"] as string | undefined,
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** PATCH /api/v1/documents/:id/verify */
export async function handleVerifyDocument(req: Request, res: Response): Promise<void> {
  const doc = await docSvc.verifyDocument(req.params["id"] as string, req.user!.id);
  res.status(200).json({ document: doc });
}

/** PATCH /api/v1/documents/:id/reject */
export async function handleRejectDocument(req: Request, res: Response): Promise<void> {
  const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
  const doc = await docSvc.rejectDocument(req.params["id"] as string, req.user!.id, reason);
  res.status(200).json({ document: doc });
}

/** GET /api/v1/documents/kyc-status — Admin: get KYC status for user(s) */
export async function handleKycStatus(req: Request, res: Response): Promise<void> {
  const userId = req.query["userId"] as string | undefined;
  if (userId) {
    const status = await docSvc.getKycStatus(userId);
    res.status(200).json(status);
  } else {
    // Bulk: get for all non-admin active users
    const { getPrisma } = await import("../config/database.js");
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: { role: { in: ["RECRUITER", "REPORTING_MANAGER"] }, status: "ACTIVE" },
      select: { id: true },
    });
    const result = await docSvc.getBulkKycStatus(users.map((u) => u.id));
    res.status(200).json({ statuses: result });
  }
}

/** POST /api/v1/documents/batch-verify — Admin: batch verify */
export async function handleBatchVerify(req: Request, res: Response): Promise<void> {
  const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
  const results = await docSvc.batchVerifyDocuments(ids, req.user!.id);
  res.status(200).json({ results });
}

/** POST /api/v1/documents/batch-reject — Admin: batch reject */
export async function handleBatchReject(req: Request, res: Response): Promise<void> {
  const body = z
    .object({ ids: z.array(z.string()).min(1), reason: z.string().min(1) })
    .parse(req.body);
  const results = await docSvc.batchRejectDocuments(body.ids, req.user!.id, body.reason);
  res.status(200).json({ results });
}

/** GET /api/v1/document-types — Admin: list all document types */
export async function handleListAllDocTypes(_req: Request, res: Response): Promise<void> {
  const types = await docSvc.listAllDocumentTypes();
  res.status(200).json({ types });
}

/** POST /api/v1/document-types — Admin: create document type */
export async function handleCreateDocType(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().min(1),
      code: z.string().min(1),
      acceptedFormats: z.array(z.string()).optional(),
      isRequired: z.boolean().optional(),
      description: z.string().optional(),
    })
    .parse(req.body);
  const type = await docSvc.createDocumentType(body);
  res.status(201).json({ type });
}

/** PATCH /api/v1/document-types/:id — Admin: update document type */
export async function handleUpdateDocType(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().optional(),
      code: z.string().optional(),
      acceptedFormats: z.array(z.string()).optional(),
      isRequired: z.boolean().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .parse(req.body);
  const type = await docSvc.updateDocumentType(req.params["id"] as string, body);
  res.status(200).json({ type });
}

/** DELETE /api/v1/document-types/:id — Admin: deactivate document type */
export async function handleDeleteDocType(req: Request, res: Response): Promise<void> {
  await docSvc.deleteDocumentType(req.params["id"] as string);
  res.status(200).json({ message: "Document type deactivated" });
}

/** GET /api/v1/documents/:id/view — §29.2 View/download document with signed URL */
export async function handleViewDocument(req: Request, res: Response): Promise<void> {
  const doc = await docSvc.getDocumentById(req.params["id"] as string);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  // §29.3 — Access control: only owner or admin
  if (doc.userId !== req.user!.id && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (!doc.storageKey) {
    res.status(404).json({ error: "Document has no stored file" });
    return;
  }

  // Generate signed URL with Content-Disposition: attachment for security.
  // Pass the explicit backend so we never have to guess from the key shape.
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
  const signedUrl = await getSignedDownloadUrl(doc.storageKey, {
    backend: doc.storageBackend,
    contentDisposition: `attachment; filename="${doc.fileName}"`,
    resourceType: doc.mimeType?.startsWith("image/") ? "image" : "raw",
  });

  res.status(200).json({
    url: signedUrl,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    contentDisposition: "attachment",
  });
}

/** PATCH /api/v1/documents/:id/status — §29.5.2 Change status any direction */
export async function handleChangeDocumentStatus(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
      reason: z.string().optional(),
    })
    .parse(req.body);
  const doc = await docSvc.changeDocumentStatus(
    req.params["id"] as string,
    body.status,
    req.user!.id,
    body.reason,
  );
  res.status(200).json({ document: doc });
}
