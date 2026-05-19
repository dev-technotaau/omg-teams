import { type DocumentStatus, type Prisma, type StorageBackend } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { deleteStorageObjects } from "../config/storage.js";
import { NotFoundError } from "../exceptions/not-found-error.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Document / KYC Service — Spec Section 29
// ──────────────────────────────────────────────

export async function uploadDocument(data: {
  userId: string;
  documentTypeId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  storageBackend?: StorageBackend | undefined;
  fileHash?: string | undefined;
}) {
  const prisma = getPrisma();

  // Delete old file from storage if replacing an existing document.
  // deleteStorageObjects tries both backends so it works regardless of
  // which one stored the previous file.
  const existing = await prisma.employeeDocument.findUnique({
    where: { userId_documentTypeId: { userId: data.userId, documentTypeId: data.documentTypeId } },
    select: { storageKey: true },
  });
  if (existing?.storageKey && existing.storageKey !== data.storageKey) {
    void deleteStorageObjects([existing.storageKey]);
  }

  const result = await prisma.employeeDocument.upsert({
    where: { userId_documentTypeId: { userId: data.userId, documentTypeId: data.documentTypeId } },
    update: {
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      storageKey: data.storageKey,
      storageBackend: data.storageBackend ?? null,
      fileHash: data.fileHash ?? null,
      status: "PENDING",
      version: { increment: 1 },
      uploadedAt: new Date(),
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null,
    },
    create: {
      userId: data.userId,
      documentTypeId: data.documentTypeId,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      storageKey: data.storageKey,
      storageBackend: data.storageBackend ?? null,
      fileHash: data.fileHash ?? null,
      status: "PENDING",
      uploadedAt: new Date(),
    },
    include: { documentType: { select: { name: true } } },
  });

  // §29.4.4 — Auto-verify offer letter uploads via hash comparison
  if (data.fileHash && result.documentType.name.toLowerCase().includes("offer")) {
    const matchingOffer = await prisma.offerLetter.findFirst({
      where: { userId: data.userId, generatedFileHash: data.fileHash, isArchived: false },
    });
    if (matchingOffer) {
      // Exact hash match → auto-verify with high confidence
      await prisma.employeeDocument.update({
        where: { id: result.id },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          adminNotes: "Auto-verified: PDF hash matches platform-generated offer letter",
        },
      });
      logger.info("Offer letter auto-verified via hash match", {
        userId: data.userId,
        offerLetterId: matchingOffer.id,
      });
    }
  }

  // Notify admins of new document upload
  const { onDocumentUploaded } = await import("./notification-triggers.js");
  void onDocumentUploaded(data.userId, result.documentType.name);

  return result;
}

export async function verifyDocument(docId: string, adminId: string) {
  const prisma = getPrisma();
  const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new NotFoundError("Document", docId);

  const oldStatus = doc.status;
  const updated = await prisma.employeeDocument.update({
    where: { id: docId },
    data: {
      status: "VERIFIED",
      verifiedBy: adminId,
      verifiedAt: new Date(),
      rejectionReason: null,
    },
    include: { documentType: { select: { name: true } } },
  });

  await prisma.employeeDocumentHistory.create({
    data: {
      employeeDocumentId: docId,
      action: "VERIFY",
      oldStatus,
      newStatus: "VERIFIED",
      actionBy: adminId,
    },
  });

  // Notify employee
  const { onDocumentVerified, onKycComplete } = await import("./notification-triggers.js");
  void onDocumentVerified(doc.userId, updated.documentType.name);

  // §29.2 — Check if all required documents are now verified → KYC complete
  const kycStatus = await getKycStatus(doc.userId);
  if (kycStatus.status === "Complete") {
    void onKycComplete(doc.userId);
  }

  return updated;
}

export async function rejectDocument(docId: string, adminId: string, reason: string) {
  const prisma = getPrisma();
  const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new NotFoundError("Document", docId);

  const oldStatus = doc.status;
  const updated = await prisma.employeeDocument.update({
    where: { id: docId },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      verifiedBy: adminId,
      verifiedAt: new Date(),
    },
    include: { documentType: { select: { name: true } } },
  });

  await prisma.employeeDocumentHistory.create({
    data: {
      employeeDocumentId: docId,
      action: "REJECT",
      oldStatus,
      newStatus: "REJECTED",
      reason,
      actionBy: adminId,
    },
  });

  // Notify employee
  const { onDocumentRejected } = await import("./notification-triggers.js");
  void onDocumentRejected(doc.userId, updated.documentType.name, reason);

  return updated;
}

/**
 * §29.5.2 — Change document status in any direction (Verified↔Pending↔Rejected).
 * Used for: Verified→Pending, Rejected→Pending, or any other revert.
 */
export async function changeDocumentStatus(
  docId: string,
  newStatus: "PENDING" | "VERIFIED" | "REJECTED",
  adminId: string,
  reason?: string,
) {
  const prisma = getPrisma();
  const doc = await prisma.employeeDocument.findUnique({
    where: { id: docId },
    include: { documentType: { select: { name: true } } },
  });
  if (!doc) throw new NotFoundError("Document", docId);

  const oldStatus = doc.status;
  if (oldStatus === newStatus) return doc;

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "PENDING") {
    updateData["verifiedBy"] = null;
    updateData["verifiedAt"] = null;
    updateData["rejectionReason"] = null;
  }

  const updated = await prisma.employeeDocument.update({
    where: { id: docId },
    data: updateData,
    include: { documentType: { select: { name: true } } },
  });

  await prisma.employeeDocumentHistory.create({
    data: {
      employeeDocumentId: docId,
      action: "STATUS_CHANGED",
      oldStatus,
      newStatus,
      reason: reason ?? null,
      actionBy: adminId,
    },
  });

  // §29.7.2 — Notify employee of status change
  const { createNotification } = await import("./notification.service.js");
  const statusLabel =
    newStatus === "PENDING" ? "Pending" : newStatus === "VERIFIED" ? "Verified" : "Rejected";
  await createNotification({
    userId: doc.userId,
    type: "DOCUMENT",
    title: `Document Status Changed`,
    message: `Your ${updated.documentType.name} status has been changed to ${statusLabel} by Admin.${reason ? ` Reason: ${reason}` : ""}`,
    actionUrl: "/documents",
  });

  return updated;
}

export async function getUserDocuments(userId: string) {
  const prisma = getPrisma();
  return prisma.employeeDocument.findMany({
    where: { userId },
    include: { documentType: true },
    orderBy: { documentType: { sortOrder: "asc" } },
  });
}

/** §29.2 — Get a single document by ID */
export async function getDocumentById(id: string) {
  const prisma = getPrisma();
  return prisma.employeeDocument.findUnique({
    where: { id },
    include: { documentType: true },
  });
}

export async function listDocumentTypes() {
  return cache.getOrSet(
    "document_types:active",
    async () => {
      const prisma = getPrisma();
      return prisma.documentType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
    },
    86400,
  ); // 24 hours
}

export async function listAllDocumentTypes() {
  const prisma = getPrisma();
  return prisma.documentType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createDocumentType(data: {
  name: string;
  code: string;
  acceptedFormats?: string[] | undefined;
  isRequired?: boolean | undefined;
  description?: string | undefined;
}) {
  const prisma = getPrisma();
  const result = await prisma.documentType.create({
    data: {
      name: data.name,
      code: data.code,
      acceptedFormats: data.acceptedFormats ?? ["application/pdf", "image/jpeg", "image/png"],
      isRequired: data.isRequired ?? false,
      description: data.description ?? null,
    },
  });
  void cache.del("document_types:active");
  return result;
}

export async function updateDocumentType(
  id: string,
  data: {
    name?: string | undefined;
    code?: string | undefined;
    acceptedFormats?: string[] | undefined;
    isRequired?: boolean | undefined;
    description?: string | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
  },
) {
  const prisma = getPrisma();
  // Strip undefined values for exactOptionalPropertyTypes compatibility
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const result = await prisma.documentType.update({ where: { id }, data: updateData });
  void cache.del("document_types:active");
  return result;
}

export async function deleteDocumentType(id: string) {
  const prisma = getPrisma();
  // Soft deactivate instead of hard delete
  const result = await prisma.documentType.update({ where: { id }, data: { isActive: false } });
  void cache.del("document_types:active");
  return result;
}

export async function listPendingDocuments(page = 1, limit = 25) {
  const prisma = getPrisma();
  const skip = (page - 1) * limit;
  const where: Prisma.EmployeeDocumentWhereInput = { status: "PENDING" };

  const [data, total] = await Promise.all([
    prisma.employeeDocument.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true } },
        documentType: { select: { name: true, code: true } },
      },
      orderBy: { uploadedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.employeeDocument.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Batch verify multiple documents (§29.5.3).
 */
export async function batchVerifyDocuments(docIds: string[], adminId: string) {
  const results = [];
  for (const id of docIds) {
    try {
      const doc = await verifyDocument(id, adminId);
      results.push({ id, success: true, status: doc.status });
    } catch {
      results.push({ id, success: false });
    }
  }
  return results;
}

/**
 * Batch reject multiple documents (§29.5.3).
 */
export async function batchRejectDocuments(docIds: string[], adminId: string, reason: string) {
  const results = [];
  for (const id of docIds) {
    try {
      const doc = await rejectDocument(id, adminId, reason);
      results.push({ id, success: true, status: doc.status });
    } catch {
      results.push({ id, success: false });
    }
  }
  return results;
}

/**
 * Get KYC completion status for a user (§29.8).
 * Returns status label and counts of verified/required docs.
 */
export async function getKycStatus(
  userId: string,
): Promise<{ status: string; verified: number; required: number }> {
  const prisma = getPrisma();

  // Count required document types
  const requiredTypes = await prisma.documentType.count({
    where: { isActive: true, isRequired: true },
  });

  // Count verified documents for this user (among required types)
  const verifiedDocs = await prisma.employeeDocument.count({
    where: {
      userId,
      status: "VERIFIED",
      documentType: { isRequired: true, isActive: true },
    },
  });

  let status: string;
  if (requiredTypes === 0) {
    status = "N/A";
  } else if (verifiedDocs >= requiredTypes) {
    status = "Complete";
  } else if (verifiedDocs > 0) {
    status = `Incomplete (${verifiedDocs}/${requiredTypes})`;
  } else {
    // Check if any docs uploaded at all
    const anyUploaded = await prisma.employeeDocument.count({
      where: { userId, documentType: { isRequired: true } },
    });
    status = anyUploaded > 0 ? "Pending Review" : "Not Started";
  }

  return { status, verified: verifiedDocs, required: requiredTypes };
}

/**
 * Get KYC statuses for multiple users (batch).
 */
export async function getBulkKycStatus(userIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const userId of userIds) {
    const { status } = await getKycStatus(userId);
    result[userId] = status;
  }
  return result;
}

export async function listAllDocuments(filters: {
  status?: DocumentStatus | undefined;
  userId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const where: Prisma.EmployeeDocumentWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;

  const [data, total] = await Promise.all([
    prisma.employeeDocument.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true } },
        documentType: { select: { name: true, code: true } },
      },
      orderBy: { uploadedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employeeDocument.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
