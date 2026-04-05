import crypto from "node:crypto";
import { type VerificationType } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Verification Token / OTP Service
//
//  Used for:
//  - Email change OTP verification
//  - Password reset tokens (future)
//
//  OTPs are 6-digit numeric codes, hashed with
//  SHA-256 before storage. Expire after 10 minutes.
// ──────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 10;

/** Generate a cryptographically secure 6-digit OTP */
export function generateOTP(): string {
  // Generate random number between 100000 and 999999
  const buffer = crypto.randomBytes(4);
  const num = (buffer.readUInt32BE(0) % 900000) + 100000;
  return num.toString();
}

/** Hash an OTP/token for storage (never store plaintext) */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a verification token and return the plaintext OTP.
 * Invalidates any existing unused tokens of the same type for this user.
 */
export async function createVerificationToken(
  userId: string,
  type: VerificationType,
  payload?: string,
): Promise<string> {
  const prisma = getPrisma();
  const otp = generateOTP();
  const hashed = hashToken(otp);

  // Invalidate existing unused tokens of same type
  await prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() }, // Mark as consumed to invalidate
  });

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      token: hashed,
      payload: payload ?? null,
      expiresAt,
    },
  });

  logger.info("Verification token created", { userId, type });
  return otp;
}

/**
 * Verify an OTP against stored tokens.
 * Returns the token record (with payload) if valid, null otherwise.
 * Marks the token as used on successful verification.
 */
export async function verifyToken(
  userId: string,
  type: VerificationType,
  otp: string,
): Promise<{ payload: string | null } | null> {
  const prisma = getPrisma();
  const hashed = hashToken(otp);

  const token = await prisma.verificationToken.findFirst({
    where: {
      userId,
      type,
      token: hashed,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!token) return null;

  // Mark as used
  await prisma.verificationToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  logger.info("Verification token verified", { userId, type });
  return { payload: token.payload };
}

/**
 * Clean up expired verification tokens (called from scheduled job).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.verificationToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });
  return result.count;
}
