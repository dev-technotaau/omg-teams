import { type LoginMethod, type Prisma, type Role } from "@prisma/client";
import { verifyBackupCode } from "./backup-code.service.js";
import { verifyPassword } from "./password.service.js";
import {
  createSession,
  destroySession,
  isAccountLocked,
  recordFailedAttempt,
  lockAccount,
  clearFailedAttempts,
  type SessionData,
} from "./session.service.js";
import { checkSuspiciousActivity } from "./suspicious-activity.service.js";
import { setAuthCookies, clearAuthCookies, setDeviceIdCookie } from "../config/cookie.js";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { ErrorCode } from "../constants/error-codes.js";
import { UnauthorizedError } from "../exceptions/unauthorized-error.js";
import { logger } from "../instrument.js";
import { verifyTurnstile } from "../utils/turnstile.js";
import type { Response } from "express";

/** Convert undefined to null for Prisma optional fields */
function toNull<T>(value: T | undefined): T | null {
  return value ?? null;
}

// ──────────────────────────────────────────────
//  Auth Service
//  Spec Section 4 — Complete Login/Logout Flow
// ──────────────────────────────────────────────

export interface LoginInput {
  /** Employee ID for Recruiter/RM, email for Admin */
  identifier: string;
  password: string;
  role: "ADMIN" | "RECRUITER" | "REPORTING_MANAGER";
  deviceId: string;
  turnstileToken: string;
  /** One-time backup code for device lock bypass (§23.16) */
  backupCode?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  geoLocation?: Record<string, unknown> | undefined;
}

export interface LoginResult {
  user: {
    id: string;
    employeeId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    profilePhotoUrl: string | null;
    status?: string;
    mobileNumber?: string | null;
    address?: string | null;
    deviceId?: string | null;
    createdAt?: string;
    lastLoginAt?: string | null;
  };
  session: SessionData;
}

// ──────────────────────────────────────────────
//  Shared post-verification login flow
//  Used by both password login and passkey login.
// ──────────────────────────────────────────────

export interface FinalizeLoginInput {
  deviceId: string;
  loginMethod: LoginMethod;
  backupCode?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  geoLocation?: Record<string, unknown> | undefined;
  /** For login history — Employee ID or email that was used */
  identifier?: string | undefined;
}

/**
 * Shared login finalization — everything after credential verification.
 * Handles: status check, device binding, session, cookies, logging, GA4.
 *
 * Both `login()` (password) and `passkeyLogin()` call this
 * after their own credential-verification steps.
 */
export async function finalizeLogin(
  user: {
    id: string;
    employeeId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    profilePhotoUrl: string | null;
    status: string;
    deviceId: string | null;
  },
  input: FinalizeLoginInput,
  res: Response,
): Promise<LoginResult> {
  const prisma = getPrisma();
  let loginMethod = input.loginMethod;

  // Account status check
  if (user.status === "SUSPENDED") {
    await logFinalizeAttempt(user.id, input, false, "Account suspended");
    throw new UnauthorizedError("Account suspended. Contact admin.", ErrorCode.ACCOUNT_DISABLED);
  }
  if (user.status === "DELETED" || user.status !== "ACTIVE") {
    await logFinalizeAttempt(user.id, input, false, "Account not active");
    throw new UnauthorizedError("Invalid credentials", ErrorCode.INVALID_CREDENTIALS);
  }

  // Device binding enforcement (skip for Admin)
  if (user.role !== "ADMIN") {
    if (!user.deviceId) {
      // First login — bind device permanently
      await prisma.user.update({
        where: { id: user.id },
        data: { deviceId: input.deviceId, deviceLockedAt: new Date() },
      });
      await prisma.userDevice.create({
        data: {
          userId: user.id,
          deviceId: input.deviceId,
          userAgent: toNull(input.userAgent),
          isActive: true,
        },
      });
    } else if (user.deviceId !== input.deviceId) {
      // Different device — check for backup code (§23.16, password-only)
      if (input.backupCode) {
        const codeValid = await verifyBackupCode(user.id, input.backupCode);
        if (!codeValid) {
          await logFinalizeAttempt(user.id, input, false, "Invalid backup code");
          throw new UnauthorizedError(
            "Invalid or already used backup code.",
            ErrorCode.INVALID_CREDENTIALS,
          );
        }

        // Backup code valid — bind new device
        loginMethod = "BACKUP_CODE";
        await prisma.userDevice.updateMany({
          where: { userId: user.id, isActive: true },
          data: { isActive: false },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId: input.deviceId, deviceLockedAt: new Date() },
        });
        await prisma.userDevice.create({
          data: {
            userId: user.id,
            deviceId: input.deviceId,
            userAgent: toNull(input.userAgent),
            isActive: true,
          },
        });

        logger.info("Device lock bypassed via backup code", { userId: user.id });

        void import("./notification-triggers.js").then(({ onBackupCodeUsed }) =>
          onBackupCodeUsed(user.id),
        );
      } else {
        // No backup code — block
        await logFinalizeAttempt(user.id, input, false, "Device mismatch");
        void checkSuspiciousActivity(user.id);
        void import("./notification-triggers.js").then(({ onLoginBlocked }) =>
          onLoginBlocked(user.id, input.deviceId),
        );
        throw new UnauthorizedError(
          "Account registered on another device. Contact admin.",
          ErrorCode.INVALID_CREDENTIALS,
        );
      }
    }
  }

  // Create session
  const session = await createSession({
    userId: user.id,
    role: user.role,
    deviceId: input.deviceId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      token: session.sessionId,
      deviceId: input.deviceId,
      ipAddress: toNull(input.ipAddress),
      geoLocation: (input.geoLocation as Prisma.InputJsonValue) ?? undefined,
      userAgent: toNull(input.userAgent),
    },
  });

  // Set BFF cookies + device ID cookie
  setDeviceIdCookie(res, input.deviceId);
  setAuthCookies(res, {
    sub: user.id,
    role: user.role,
    deviceId: input.deviceId,
    sessionId: session.sessionId,
  });

  // Clear failed attempts + log success
  await clearFailedAttempts(user.id);
  await logFinalizeAttempt(user.id, input, true, undefined, loginMethod);

  // GA4 server-side: track login event
  void import("../utils/analytics.js").then(({ trackEvent: gaTrack }) =>
    gaTrack(user.id, { name: "login", params: { method: loginMethod, role: user.role } }),
  );

  return {
    user: {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profilePhotoUrl: user.profilePhotoUrl,
    },
    session,
  };
}

/** Log attempt for the shared finalize flow */
async function logFinalizeAttempt(
  userId: string | null,
  input: FinalizeLoginInput,
  success: boolean,
  failureReason?: string,
  loginMethod: LoginMethod = "PASSWORD",
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.loginHistory.create({
      data: {
        userId,
        attemptedId: toNull(input.identifier),
        attemptedDeviceId: toNull(input.deviceId),
        ip: toNull(input.ipAddress),
        userAgent: toNull(input.userAgent),
        success,
        failureReason: toNull(failureReason),
        loginMethod,
      },
    });
  } catch (err) {
    logger.error("Failed to log login attempt", { error: (err as Error).message });
  }
}

// ──────────────────────────────────────────────
//  Passkey Login
// ──────────────────────────────────────────────

export interface PasskeyLoginInput {
  /** Already-verified user from WebAuthn credential lookup */
  user: {
    id: string;
    employeeId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    profilePhotoUrl: string | null;
    status: string;
    deviceId: string | null;
  };
  deviceId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  geoLocation?: Record<string, unknown> | undefined;
}

/**
 * Passkey login — called after WebAuthn credential is cryptographically verified.
 * Delegates to finalizeLogin() for the shared flow.
 */
export async function passkeyLogin(input: PasskeyLoginInput, res: Response): Promise<LoginResult> {
  return finalizeLogin(
    input.user,
    {
      deviceId: input.deviceId,
      loginMethod: "PASSKEY",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      geoLocation: input.geoLocation,
      identifier: input.user.email,
    },
    res,
  );
}

/**
 * Complete login flow — Steps 1-9 from Spec Section 4.
 * Attendance (step 10) and Firebase/Socket (steps 11-12) are handled by callers.
 */
export async function login(input: LoginInput, res: Response): Promise<LoginResult> {
  const prisma = getPrisma();

  // Step 1: Validate Turnstile captcha
  const turnstileValid = await verifyTurnstile(input.turnstileToken, input.ipAddress);
  if (!turnstileValid) {
    await logLoginAttempt(null, input, false, "Captcha verification failed");
    throw new UnauthorizedError("Captcha verification failed", ErrorCode.INVALID_CREDENTIALS);
  }

  // Step 3: Credential lookup — find user by Employee ID (Recruiter/RM) or email (Admin)
  let user;
  if (input.role === "ADMIN") {
    user = await prisma.user.findFirst({
      where: { email: input.identifier, role: "ADMIN" },
    });
  } else {
    user = await prisma.user.findFirst({
      where: { employeeId: input.identifier, role: input.role },
    });
  }

  if (!user) {
    await logLoginAttempt(null, input, false, "User not found");
    throw new UnauthorizedError(
      input.role === "ADMIN" ? "Invalid email or password" : "Invalid Employee ID or password",
      ErrorCode.INVALID_CREDENTIALS,
    );
  }

  // Step 2: Account lockout check
  if (await isAccountLocked(user.id)) {
    await logLoginAttempt(user.id, input, false, "Account locked");
    throw new UnauthorizedError(
      "Account temporarily locked. Contact admin.",
      ErrorCode.ACCOUNT_LOCKED,
    );
  }

  // Step 4: Password validation
  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    const attempts = await recordFailedAttempt(user.id);
    await logLoginAttempt(user.id, input, false, "Invalid password");

    // Lock account after max attempts — notify Admin (§25.1)
    if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
      await lockAccount(user.id);
      void import("./notification-triggers.js").then(({ onAccountLockout }) =>
        onAccountLockout(user.id, attempts),
      );
    }

    // §22.12 — Check for suspicious patterns
    void checkSuspiciousActivity(user.id);

    throw new UnauthorizedError(
      input.role === "ADMIN" ? "Invalid email or password" : "Invalid Employee ID or password",
      ErrorCode.INVALID_CREDENTIALS,
    );
  }

  // Steps 5-9: Delegate to shared finalizeLogin()
  return finalizeLogin(
    user,
    {
      deviceId: input.deviceId,
      loginMethod: "PASSWORD",
      backupCode: input.backupCode,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      geoLocation: input.geoLocation,
      identifier: input.identifier,
    },
    res,
  );
}

/**
 * Complete logout flow — Steps 1-4 from Spec Section 4.
 * Firebase/Socket (steps 5-6) handled by callers.
 */
export async function logout(sessionId: string, res: Response): Promise<void> {
  // Step 1: Destroy Redis session
  const session = await destroySession(sessionId);

  // Step 2: Clear cookies
  clearAuthCookies(res);

  if (session) {
    // Mark DB session as revoked
    const prisma = getPrisma();
    await prisma.session.updateMany({
      where: { token: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Step 4: Attendance punch-out will be handled by attendance service
    // (called by controller after this returns)

    // Step 5: Clear presence
    const { clearPresence, broadcastPresence } = await import("./presence.service.js");
    void clearPresence(session.userId).then(() => broadcastPresence(session.userId, "offline"));
  }
}

/**
 * Get current authenticated user data.
 */
export async function getCurrentUser(userId: string): Promise<LoginResult["user"] | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      employeeId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      profilePhotoUrl: true,
      status: true,
      mobileNumber: true,
      address: true,
      deviceId: true,
      createdAt: true,
    },
  });

  if (user?.status !== "ACTIVE") return null;

  // Get last login for profile display
  const lastLogin = await prisma.loginHistory.findFirst({
    where: { userId, success: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    profilePhotoUrl: user.profilePhotoUrl,
    status: user.status,
    mobileNumber: user.mobileNumber,
    address: user.address,
    deviceId: user.deviceId,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
  };
}

// ──────────────────────────────────────────────
//  Login History
// ──────────────────────────────────────────────

async function logLoginAttempt(
  userId: string | null,
  input: LoginInput,
  success: boolean,
  failureReason?: string,
  loginMethod: "PASSWORD" | "BACKUP_CODE" = "PASSWORD",
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.loginHistory.create({
      data: {
        userId: toNull(userId),
        attemptedId: toNull(input.identifier),
        attemptedDeviceId: toNull(input.deviceId),
        ip: toNull(input.ipAddress),
        userAgent: toNull(input.userAgent),
        success,
        failureReason: toNull(failureReason),
        loginMethod,
      },
    });
  } catch (err) {
    logger.error("Failed to log login attempt", { error: (err as Error).message });
  }
}

// ──────────────────────────────────────────────
//  Admin Notifications — §25.1, §23.16
// ──────────────────────────────────────────────

// Migrated to centralized notification-triggers.ts
// (onAccountLockout, onBackupCodeUsed)
