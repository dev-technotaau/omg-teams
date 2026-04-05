import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Backup Code Service — Spec Section 23.16
//  One-time emergency codes for device lock bypass
// ──────────────────────────────────────────────

const CODE_COUNT = 8;
const CODE_LENGTH = 8; // 8 alphanumeric chars, formatted as XXXX-XXXX
const SALT_ROUNDS = 12;

/**
 * Generate a random alphanumeric code formatted as XXXX-XXXX.
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous: 0/O, 1/I
  let code = "";
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Generate 8 backup codes for a user.
 * Deletes any existing codes first (regeneration).
 * Returns plaintext codes — these are shown ONCE and never again.
 */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const prisma = getPrisma();

  // Delete all existing backup codes for this user
  await prisma.backupCode.deleteMany({ where: { userId } });

  const plaintextCodes: string[] = [];
  const data: { userId: string; codeHash: string }[] = [];

  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateCode();
    plaintextCodes.push(code);
    const hash = await bcrypt.hash(code.replace("-", ""), SALT_ROUNDS);
    data.push({ userId, codeHash: hash });
  }

  await prisma.backupCode.createMany({ data });

  logger.info("Backup codes generated", { userId, count: CODE_COUNT });
  return plaintextCodes;
}

/**
 * Verify a backup code for a user.
 * If valid: marks the code as used, returns true.
 * If invalid or already used: returns false.
 */
export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const prisma = getPrisma();
  const normalizedCode = code.replace("-", "").toUpperCase();

  // Get all unused codes for this user
  const unusedCodes = await prisma.backupCode.findMany({
    where: { userId, isUsed: false },
  });

  // Try each code — bcrypt compare is the only way to check
  for (const stored of unusedCodes) {
    const matches = await bcrypt.compare(normalizedCode, stored.codeHash);
    if (matches) {
      // Mark as used
      await prisma.backupCode.update({
        where: { id: stored.id },
        data: { isUsed: true, usedAt: new Date() },
      });
      logger.info("Backup code used", { userId, codeId: stored.id });
      return true;
    }
  }

  return false;
}

/**
 * Get backup code status for a user (how many total, how many remaining).
 */
export async function getBackupCodeStatus(userId: string): Promise<{
  total: number;
  remaining: number;
  generatedAt: Date | null;
}> {
  const prisma = getPrisma();
  const codes = await prisma.backupCode.findMany({
    where: { userId },
    select: { isUsed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    total: codes.length,
    remaining: codes.filter((c) => !c.isUsed).length,
    generatedAt: codes.length > 0 ? codes[0]!.createdAt : null,
  };
}
