import { type Zone } from "@prisma/client";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Form Auto-Save / Draft System
//  Spec Section 23.8
//
//  - Auto-saves every 30 seconds, on blur, on beforeunload
//  - One draft per recruiter (upsert)
//  - Deleted on successful form submission
// ──────────────────────────────────────────────

export async function saveDraft(
  recruiterId: string,
  zone: Zone | null,
  formData: Record<string, unknown>,
) {
  const prisma = getPrisma();
  return prisma.candidateReportDraft.upsert({
    where: { recruiterId },
    update: {
      zone,
      formData: formData as object,
      lastSavedAt: new Date(),
    },
    create: {
      recruiterId,
      zone,
      formData: formData as object,
    },
  });
}

export async function getDraft(recruiterId: string) {
  const prisma = getPrisma();
  return prisma.candidateReportDraft.findUnique({
    where: { recruiterId },
  });
}

export async function deleteDraft(recruiterId: string) {
  const prisma = getPrisma();
  await prisma.candidateReportDraft.deleteMany({
    where: { recruiterId },
  });
}
