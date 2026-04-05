import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

// ──────────────────────────────────────────────
//  Password Hashing & Validation
//  Spec Section 4, 25.2
// ──────────────────────────────────────────────

const SALT_ROUNDS = 12;

// Common passwords blocklist (top 100 — extend as needed)
const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "password1",
  "admin123",
  "letmein",
  "welcome",
  "monkey",
  "master",
  "dragon",
  "login",
  "princess",
  "football",
  "shadow",
  "sunshine",
  "trustno1",
  "iloveyou",
  "batman",
  "access",
  "hello",
  "charlie",
  "donald",
]);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password against complexity rules from env config.
 * Spec Section 25.2
 */
export function validatePasswordComplexity(
  password: string,
  context?: { email?: string; firstName?: string; lastName?: string },
): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < env.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${env.PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > env.PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${env.PASSWORD_MAX_LENGTH} characters`);
  }
  if (env.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (env.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (env.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push("Password must contain at least one digit");
  }
  if (env.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Common password check
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
  }

  // Personal info rejection
  if (context) {
    const lower = password.toLowerCase();
    if (context.email && lower.includes(context.email.split("@")[0]?.toLowerCase() ?? "")) {
      errors.push("Password must not contain your email");
    }
    if (
      context.firstName &&
      context.firstName.length > 2 &&
      lower.includes(context.firstName.toLowerCase())
    ) {
      errors.push("Password must not contain your name");
    }
    if (
      context.lastName &&
      context.lastName.length > 2 &&
      lower.includes(context.lastName.toLowerCase())
    ) {
      errors.push("Password must not contain your name");
    }
  }

  return { valid: errors.length === 0, errors };
}
