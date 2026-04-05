import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { deleteStorageObjects } from "../config/storage.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Offer Letter Service — Spec Section 29.4
// ──────────────────────────────────────────────

export async function listOfferLetters(filters?: {
  userId?: string;
  page?: number;
  limit?: number;
}) {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 25;
  const where: Record<string, unknown> = {};
  if (filters?.userId) where["userId"] = filters.userId;

  const [data, total] = await Promise.all([
    prisma.offerLetter.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
        },
        generator: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.offerLetter.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getOfferLetter(id: string) {
  const prisma = getPrisma();
  return prisma.offerLetter.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
      },
      generator: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/** §29.4.2 — Generate reference number in format HF/OL/YYYY/NNN */
async function generateReferenceNumber(): Promise<string> {
  const prisma = getPrisma();
  const year = new Date().getFullYear();
  const prefix = `HF/OL/${year}/`;

  // Find the highest existing number for this year
  const latest = await prisma.offerLetter.findFirst({
    where: { referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: "desc" },
    select: { referenceNumber: true },
  });

  let nextNum = 1;
  if (latest?.referenceNumber) {
    const numPart = latest.referenceNumber.replace(prefix, "");
    nextNum = (parseInt(numPart, 10) || 0) + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

export async function createOfferLetter(
  data: {
    userId: string;
    variant: "TEMPLATE" | "TIPTAP_EDITOR";
    dynamicFields?: Record<string, unknown>;
    editorContent?: string;
  },
  generatedBy: string,
) {
  const prisma = getPrisma();
  const referenceNumber = await generateReferenceNumber();

  return prisma.offerLetter.create({
    data: {
      userId: data.userId,
      referenceNumber,
      variant: data.variant,
      dynamicFields: data.dynamicFields
        ? (data.dynamicFields as Prisma.InputJsonValue)
        : Prisma.DbNull,
      editorContent: data.editorContent ?? null,
      generatedBy,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
    },
  });
}

export async function updateOfferLetter(
  id: string,
  data: {
    dynamicFields?: Record<string, unknown>;
    editorContent?: string;
    generatedFileUrl?: string;
    generatedFileHash?: string;
    storageKey?: string;
  },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.dynamicFields !== undefined) updateData["dynamicFields"] = data.dynamicFields;
  if (data.editorContent !== undefined) updateData["editorContent"] = data.editorContent;
  if (data.generatedFileUrl !== undefined) updateData["generatedFileUrl"] = data.generatedFileUrl;
  if (data.generatedFileHash !== undefined)
    updateData["generatedFileHash"] = data.generatedFileHash;
  if (data.storageKey !== undefined) updateData["storageKey"] = data.storageKey;
  return prisma.offerLetter.update({ where: { id }, data: updateData });
}

export async function archiveOfferLetter(id: string) {
  const prisma = getPrisma();
  return prisma.offerLetter.update({ where: { id }, data: { isArchived: true } });
}

/**
 * §29.4.5 — Re-generate: archive old, create new with fresh reference number.
 */
export async function regenerateOfferLetter(oldId: string, generatedBy: string) {
  const prisma = getPrisma();
  const old = await prisma.offerLetter.findUnique({ where: { id: oldId } });
  if (!old) throw new Error("Offer letter not found");

  await prisma.offerLetter.update({ where: { id: oldId }, data: { isArchived: true } });

  // Clean up old PDF from R2 if it exists
  if (old.generatedFileUrl) {
    const oldKey = `offer-letters/${old.userId}/${old.referenceNumber}.pdf`;
    void deleteStorageObjects([oldKey]);
    logger.info("Old offer letter PDF queued for deletion", { oldId, oldKey });
  }

  const referenceNumber = await generateReferenceNumber();
  const createData: Parameters<typeof prisma.offerLetter.create>[0]["data"] = {
    userId: old.userId,
    referenceNumber,
    variant: old.variant,
    templateVersion: (old.templateVersion ?? 1) + 1,
    generatedBy,
    status: "DRAFT",
  };
  if (old.dynamicFields !== null) createData.dynamicFields = old.dynamicFields;
  if (old.editorContent !== null) createData.editorContent = old.editorContent;

  return prisma.offerLetter.create({
    data: createData,
    include: {
      user: { select: { firstName: true, lastName: true, email: true, employeeId: true } },
    },
  });
}
