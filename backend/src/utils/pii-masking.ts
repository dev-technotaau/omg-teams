// ──────────────────────────────────────────────
//  PII Data Masking — Spec §25.5
//
//  Masks sensitive fields for non-admin views.
//  RM sees: phone ****-**-1234, email jak***@gmail.com
//  Recruiter sees own data in full, cannot see others'.
// ──────────────────────────────────────────────

/**
 * Mask a phone number: show only last 4 digits.
 * "9876543210" → "******3210"
 * "+91-9876543210" → "********3210"
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  const visible = digits.slice(-4);
  const masked = "*".repeat(digits.length - 4);
  return `${masked}${visible}`;
}

/**
 * Mask an email: show first 3 chars of local part + *** + @domain.
 * "jakedoe@gmail.com" → "jak***@gmail.com"
 * "ab@test.com" → "ab***@test.com"
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visibleChars = Math.min(3, local.length);
  return `${local.slice(0, visibleChars)}***${domain}`;
}

/**
 * Mask a date of birth: show only year.
 * "1995-06-15" → "****-**-**"
 */
export function maskDob(dob: string | Date | null | undefined): string | null {
  if (!dob) return null;
  return "****-**-**";
}

/**
 * Apply PII masking to a candidate record based on viewer role.
 * - ADMIN: no masking
 * - RECRUITER viewing own data: no masking
 * - REPORTING_MANAGER: mask phone, email, DOB
 */
export function maskCandidateRecord<T extends Record<string, unknown>>(
  record: T,
  viewerRole: string,
  viewerUserId: string,
): T {
  // Admin sees everything
  if (viewerRole === "ADMIN") return record;

  // Recruiter sees own data unmasked
  if (viewerRole === "RECRUITER" && record["recruiterId"] === viewerUserId) {
    return record;
  }

  // RM and other roles get masked PII
  const masked: Record<string, unknown> = { ...record };

  if ("contactNo" in masked && typeof masked["contactNo"] === "string") {
    masked["contactNo"] = maskPhone(masked["contactNo"]);
  }
  if ("emailId" in masked && typeof masked["emailId"] === "string") {
    masked["emailId"] = maskEmail(masked["emailId"]);
  }
  if ("dateOfBirth" in masked) {
    masked["dateOfBirth"] = maskDob(masked["dateOfBirth"] as string | Date | null);
  }

  return masked as T;
}

/**
 * Apply PII masking to an array of candidate records.
 */
export function maskCandidateRecords<T extends Record<string, unknown>>(
  records: T[],
  viewerRole: string,
  viewerUserId: string,
): T[] {
  return records.map((r) => maskCandidateRecord(r, viewerRole, viewerUserId));
}
