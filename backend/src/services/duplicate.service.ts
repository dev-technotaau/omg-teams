import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Candidate Duplicate Detection
//  Spec Section 23.3
//
//  Checks phone + email against existing records.
//  Returns matches for the recruiter to review.
// ──────────────────────────────────────────────

export interface DuplicateMatch {
  id: string;
  candidateName: string | null;
  contactNo: string | null;
  emailId: string | null;
  matchType: "phone" | "email" | "both";
  recruiterName: string;
  createdAt: Date;
}

/**
 * Check for duplicate candidates by phone and/or email.
 * Called before saving a new candidate report.
 */
export async function checkDuplicates(
  contactNo: string | null | undefined,
  emailId: string | null | undefined,
  excludeId?: string,
): Promise<DuplicateMatch[]> {
  if (!contactNo && !emailId) return [];

  const prisma = getPrisma();
  const conditions = [];

  if (contactNo) {
    conditions.push({ contactNo, deletedAt: null });
  }
  if (emailId) {
    conditions.push({ emailId, deletedAt: null });
  }

  const matches = await prisma.candidateReport.findMany({
    where: {
      OR: conditions,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      candidateName: true,
      contactNo: true,
      emailId: true,
      createdAt: true,
      recruiter: { select: { firstName: true, lastName: true } },
    },
    take: 10,
  });

  return matches.map((m) => {
    const phoneMatch = contactNo ? m.contactNo === contactNo : false;
    const emailMatch = emailId ? m.emailId === emailId : false;

    return {
      id: m.id,
      candidateName: m.candidateName,
      contactNo: m.contactNo,
      emailId: m.emailId,
      matchType: phoneMatch && emailMatch ? "both" : phoneMatch ? "phone" : "email",
      recruiterName: `${m.recruiter.firstName} ${m.recruiter.lastName}`,
      createdAt: m.createdAt,
    };
  });
}

/**
 * Create a duplicate group linking matching candidate records.
 */
export async function createDuplicateGroup(candidateReportIds: string[]) {
  const prisma = getPrisma();
  const group = await prisma.duplicateGroup.create({ data: {} });

  await prisma.duplicateGroupMember.createMany({
    data: candidateReportIds.map((id) => ({
      duplicateGroupId: group.id,
      candidateReportId: id,
    })),
  });

  // Flag the candidate reports
  await prisma.candidateReport.updateMany({
    where: { id: { in: candidateReportIds } },
    data: { isDuplicate: true, duplicateGroupId: group.id },
  });

  return group;
}

/**
 * Resolve a duplicate group (admin action).
 */
export async function resolveDuplicateGroup(
  groupId: string,
  resolvedByUserId: string,
  action: "RESOLVED" | "DISMISSED",
) {
  const prisma = getPrisma();
  return prisma.duplicateGroup.update({
    where: { id: groupId },
    data: {
      status: action,
      resolvedAt: new Date(),
      resolvedByUserId,
    },
  });
}

/**
 * Merge duplicate candidates — keep primary, merge data from secondaries, soft-delete them.
 */
export async function mergeDuplicates(
  groupId: string,
  primaryCandidateId: string,
  mergedByUserId: string,
) {
  const prisma = getPrisma();

  // Fetch group with all members
  const group = await prisma.duplicateGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          candidate: true,
        },
      },
    },
  });

  if (!group) throw new Error("Duplicate group not found");
  if (group.status !== "PENDING") throw new Error("Group already resolved");

  const primaryMember = group.members.find((m) => m.candidateReportId === primaryCandidateId);
  if (!primaryMember) throw new Error("Primary candidate not in this group");

  const primary = primaryMember.candidate;
  const secondaries = group.members
    .filter((m) => m.candidateReportId !== primaryCandidateId)
    .map((m) => m.candidate);

  // Merge: fill null fields in primary from secondaries (first non-null wins)
  const mergeFields = [
    "candidateName",
    "contactNo",
    "state",
    "location",
    "profile",
    "yearsOfExperience",
    "currentCtc",
    "currentDesignation",
    "currentOrganization",
    "emailId",
    "higherQualification",
    "expectedCtc",
    "diplomaPartFull",
    "graduationPercent",
    "graduationYear",
    "twelfthPassingYear",
    "twelfthPercent",
    "tenthPassingYear",
    "tenthPercent",
    "dateOfBirth",
    "noticePeriod",
    "remarks",
    "isCtcInformed",
    "isOffRollOkay",
    "isOnRollExplained",
    "hasTwoWheeler",
    "communicationSkill",
    "companyId",
    "serviceProviderId",
    "hrManagerId",
    "adminLocation",
    "adminState",
    "dateOfJoining",
    "cvSharedOnDate",
    "hrFeedback",
  ] as const;

  const updateData: Record<string, unknown> = {};
  for (const field of mergeFields) {
    if (
      (primary as Record<string, unknown>)[field] === null ||
      (primary as Record<string, unknown>)[field] === undefined
    ) {
      for (const sec of secondaries) {
        const val = (sec as Record<string, unknown>)[field];
        if (val !== null && val !== undefined) {
          updateData[field] = val;
          break;
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update primary with merged data
    if (Object.keys(updateData).length > 0) {
      await tx.candidateReport.update({
        where: { id: primaryCandidateId },
        data: updateData,
      });
    }

    // Clear duplicate flag on primary
    await tx.candidateReport.update({
      where: { id: primaryCandidateId },
      data: { isDuplicate: false, duplicateGroupId: null },
    });

    // Soft-delete secondaries
    const now = new Date();
    await tx.candidateReport.updateMany({
      where: { id: { in: secondaries.map((s) => s.id) } },
      data: { deletedAt: now, deletedBy: mergedByUserId },
    });

    // Resolve the group
    await tx.duplicateGroup.update({
      where: { id: groupId },
      data: { status: "RESOLVED", resolvedAt: now, resolvedByUserId: mergedByUserId },
    });
  });

  return prisma.candidateReport.findUnique({
    where: { id: primaryCandidateId },
    include: {
      recruiter: { select: { firstName: true, lastName: true } },
    },
  });
}

/**
 * List all pending duplicate groups with their members.
 */
export async function listDuplicateGroups(status?: "PENDING" | "RESOLVED" | "DISMISSED") {
  const prisma = getPrisma();
  return prisma.duplicateGroup.findMany({
    where: status ? { status } : {},
    include: {
      members: {
        include: {
          candidate: {
            select: {
              id: true,
              candidateName: true,
              contactNo: true,
              emailId: true,
              createdAt: true,
              recruiter: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { detectedAt: "desc" },
  });
}
