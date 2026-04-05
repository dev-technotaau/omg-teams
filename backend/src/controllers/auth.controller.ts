import { z } from "zod";
import { extractRefreshToken, setAuthCookies, clearAuthCookies } from "../config/cookie.js";
import { logger } from "../instrument.js";
import { login, logout, getCurrentUser } from "../services/auth.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Auth Controller
//  Spec Section 4 — Login/Logout/Refresh/Me
// ──────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["ADMIN", "RECRUITER", "REPORTING_MANAGER"]),
  deviceId: z.string().min(1, "Device ID is required"),
  turnstileToken: z.string().min(1, "Captcha token is required"),
  backupCode: z.string().optional(),
});

/**
 * POST /api/v1/auth/login
 */
export async function handleLogin(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);

  const result = await login(
    {
      identifier: body.identifier,
      password: body.password,
      role: body.role,
      deviceId: body.deviceId,
      turnstileToken: body.turnstileToken,
      ...(body.backupCode !== undefined && { backupCode: body.backupCode }),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      // §4 — Geo data from Cloudflare/proxy headers for admin session view
      geoLocation: {
        country: (req.headers["cf-ipcountry"] ?? req.headers["x-vercel-ip-country"] ?? null) as
          | string
          | null,
        city: (req.headers["cf-ipcity"] ?? req.headers["x-vercel-ip-city"] ?? null) as
          | string
          | null,
        region: (req.headers["cf-region"] ?? req.headers["x-vercel-ip-country-region"] ?? null) as
          | string
          | null,
      },
    },
    res,
  );

  logger.info("User logged in", { userId: result.user.id, role: result.user.role });

  // Step 10: Attendance punch-in (non-admin only, fire-and-forget)
  if (result.user.role !== "ADMIN") {
    const { punchIn } = await import("../services/attendance.service.js");
    void punchIn(result.user.id);
  }

  res.status(200).json({
    user: result.user,
    sessionId: result.session.sessionId,
  });
}

/**
 * POST /api/v1/auth/logout
 */
export async function handleLogout(req: Request, res: Response): Promise<void> {
  const sessionId = req.user?.sessionId;
  if (sessionId) {
    // Attendance punch-out before session destruction (non-admin only)
    if (req.user?.id && req.user.role !== "ADMIN") {
      const { punchOut } = await import("../services/attendance.service.js");
      await punchOut(req.user.id);
    }

    await logout(sessionId, res);
    logger.info("User logged out", { userId: req.user?.id });
  } else {
    clearAuthCookies(res);
  }

  res.status(200).json({ message: "Logged out" });
}

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token cookie.
 */
export async function handleRefresh(req: Request, res: Response): Promise<void> {
  const refreshPayload = extractRefreshToken(req);
  if (refreshPayload?.type !== "refresh") {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const user = await getCurrentUser(refreshPayload.sub);
  if (!user) {
    clearAuthCookies(res);
    res.status(401).json({ error: "User not found" });
    return;
  }

  // Issue new tokens
  setAuthCookies(res, { sub: user.id, role: user.role });

  res.status(200).json({ message: "Token refreshed" });
}

/**
 * GET /api/v1/auth/me
 * Get current authenticated user.
 */
export async function handleMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await getCurrentUser(req.user.id);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ user });
}

/**
 * PATCH /api/v1/auth/me/profile
 * Update own profile (mobile number, address).
 */
export async function handleUpdateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { z } = await import("zod");
  const body = z
    .object({
      mobileNumber: z.string().optional(),
      address: z.string().optional(),
    })
    .parse(req.body);

  const { updateProfile } = await import("../services/user.service.js");
  await updateProfile(req.user.id, {
    ...(body.mobileNumber !== undefined && { mobileNumber: body.mobileNumber }),
    ...(body.address !== undefined && { address: body.address }),
  });

  const user = await getCurrentUser(req.user.id);
  res.status(200).json({ user });
}

/** POST /api/v1/auth/verify-password — Admin verifies own password for sensitive actions (Spec 6.3.3) */
export async function handleVerifyPassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { z } = await import("zod");
  const body = z.object({ password: z.string().min(1) }).parse(req.body);

  const { getPrisma } = await import("../config/database.js");
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { verifyPassword } = await import("../services/password.service.js");
  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    res.status(403).json({ error: "Invalid password" });
    return;
  }

  res.status(200).json({ verified: true });
}
