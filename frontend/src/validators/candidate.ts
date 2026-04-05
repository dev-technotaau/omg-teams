// ──────────────────────────────────────────────
//  Candidate Report Validation Schemas
//  Spec Section 5.2 — 33 fields
// ──────────────────────────────────────────────

import { z } from "zod";

/**
 * Recruiter report form schema — matches backend createSchema
 * and all 33 fields from §5.2.
 */
export const candidateReportSchema = z.object({
  // §5.2 #2 — Date Sourced
  dateSourced: z.string().optional(),
  // §5.2 #3 — Candidate Name
  candidateName: z.string().min(1, "Candidate name is required").max(200),
  // §5.2 #4 — Contact No
  contactNo: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number")
    .optional()
    .or(z.literal("")),
  // §5.2 #12 — Email ID
  emailId: z.string().email("Invalid email").optional().or(z.literal("")),
  // §5.2 #5 — State (admin-configurable dropdown)
  state: z.string().max(100).optional(),
  // §5.2 #6 — Location (admin-configurable dropdown)
  location: z.string().max(200).optional(),
  // §5.2 #7 — Profile (admin-configurable dropdown)
  profile: z.string().max(200).optional(),
  // §5.2 #8 — Years of Experience
  yearsOfExperience: z.coerce.number().nonnegative().optional(),
  // §5.2 #9 — Current CTC
  currentCtc: z.coerce.number().nonnegative().optional(),
  // §5.2 #10 — Current Designation
  currentDesignation: z.string().max(200).optional(),
  // §5.2 #11 — Current Organization
  currentOrganization: z.string().max(200).optional(),
  // §5.2 #13 — Higher Qualification (admin-configurable dropdown)
  higherQualification: z.string().max(200).optional(),
  // §5.2 #14 — Expected CTC
  expectedCtc: z.coerce.number().nonnegative().optional(),
  // §5.2 #15 — Diploma Part / Full (admin-configurable dropdown)
  diplomaPartFull: z.string().optional(),
  // §5.2 #16 — Graduation %
  graduationPercent: z.coerce.number().min(0).max(100).optional(),
  // §5.2 #17 — Graduation Year
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  // §5.2 #18 — 12th Passing Year
  twelfthPassingYear: z.coerce.number().int().min(1950).max(2100).optional(),
  // §5.2 #19 — 12th %
  twelfthPercent: z.coerce.number().min(0).max(100).optional(),
  // §5.2 #20 — 10th Passing Year
  tenthPassingYear: z.coerce.number().int().min(1950).max(2100).optional(),
  // §5.2 #21 — 10th %
  tenthPercent: z.coerce.number().min(0).max(100).optional(),
  // §5.2 #22 — Date of Birth
  dateOfBirth: z.string().optional(),
  // §5.2 #24 — Notice Period (admin-configurable dropdown)
  noticePeriod: z.string().optional(),
  // §5.2 #25 — Remarks
  remarks: z.string().max(1000).optional(),
  // §5.2 #26–30 — Zone-conditional screening fields (Set A only)
  isCtcInformed: z.boolean().optional(),
  isOffRollOkay: z.boolean().optional(),
  isOnRollExplained: z.boolean().optional(),
  hasTwoWheeler: z.boolean().optional(),
  communicationSkill: z.coerce.number().int().min(1).max(10).optional(),
  // §5.2 #33 — Status
  status: z.string().optional(),
});

export type CandidateReportInput = z.infer<typeof candidateReportSchema>;
