import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import * as candidateSvc from "../services/candidate.service.js";
import * as pipelineSvc from "../services/pipeline.service.js";
import type { Request, Response } from "express";

const stageEnum = z.enum([
  "SOURCED",
  "SCREENED",
  "CV_SHARED",
  "INTERVIEW_SCHEDULED",
  "SELECTED",
  "JOINED",
  "INVOICED",
  "CLOSED",
  "REJECTED",
  "ON_HOLD",
]);

/** PATCH /api/v1/candidates/:id/stage — Update pipeline stage */
export async function handleUpdateStage(req: Request, res: Response): Promise<void> {
  const { stage, notes } = z
    .object({
      stage: stageEnum,
      notes: z.string().optional(),
    })
    .parse(req.body);

  const report = await pipelineSvc.updateCandidateStage(
    req.params["id"] as string,
    stage,
    req.user!.id,
    req.user!.role,
    notes,
  );
  res.status(200).json({ report });
}

/** GET /api/v1/candidates/:id/stage-history — scoped by ownership */
export async function handleGetStageHistory(req: Request, res: Response): Promise<void> {
  const candidateId = req.params["id"] as string;
  const report = await candidateSvc.getCandidateReport(candidateId);

  // Enforce same ownership rules as GET /candidates/:id
  const { role, id: userId } = req.user!;
  if (role === "RECRUITER" && report.recruiterId !== userId) {
    throw new ForbiddenError("You can only view stage history for your own candidates");
  }
  if (role === "REPORTING_MANAGER") {
    const prisma = getPrisma();
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: userId, removedAt: null },
      select: { recruiterId: true },
    });
    const teamIds = assignments.map((a) => a.recruiterId);
    teamIds.push(userId);
    if (!teamIds.includes(report.recruiterId)) {
      throw new ForbiddenError("This candidate does not belong to your team");
    }
  }

  const history = await pipelineSvc.getStageHistory(candidateId);
  res.status(200).json({ history });
}
