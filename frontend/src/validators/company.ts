// ──────────────────────────────────────────────
//  Company Validation Schemas
// ──────────────────────────────────────────────

import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const serviceProviderSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  companyId: z.string().min(1, "Company is required"),
});

export type ServiceProviderInput = z.infer<typeof serviceProviderSchema>;

export const hrManagerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  companyId: z.string().min(1, "Company is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid mobile number")
    .optional()
    .or(z.literal("")),
});

export type HRManagerInput = z.infer<typeof hrManagerSchema>;
