import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../instrument.js";
import { enqueueEmail } from "../jobs/email.queue.js";
import {
  hashPassword,
  verifyPassword,
  validatePasswordComplexity,
} from "../services/password.service.js";
import { destroyUserSessions } from "../services/session.service.js";
import { createVerificationToken, verifyToken } from "../services/verification.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Account Management Controller
//
//  Self-service account actions for the admin:
//  - Change own password (with current password verification)
//  - Request email change (sends OTP to new email)
//  - Verify email change (confirms OTP)
//  - Update mobile number (with current password verification)
// ──────────────────────────────────────────────

// ── Schemas ──

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required"),
});

const requestEmailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required for verification"),
});

const verifyEmailChangeSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const updateMobileSchema = z.object({
  mobileNumber: z.string().min(1, "Mobile number is required"),
  password: z.string().min(1, "Password is required for verification"),
});

// ──────────────────────────────────────────────
//  POST /api/v1/auth/me/change-password
// ──────────────────────────────────────────────

export async function handleChangePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = changePasswordSchema.parse(req.body);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, firstName: true, lastName: true, email: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Step 1: Verify current password
  const currentValid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!currentValid) {
    res.status(403).json({ error: "Current password is incorrect" });
    return;
  }

  // Step 2: Validate new password complexity
  const validation = validatePasswordComplexity(body.newPassword, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  if (!validation.valid) {
    res
      .status(400)
      .json({ error: "Password does not meet requirements", details: validation.errors });
    return;
  }

  // Step 3: Ensure new password differs from current
  const sameAsCurrent = await verifyPassword(body.newPassword, user.passwordHash);
  if (sameAsCurrent) {
    res.status(400).json({ error: "New password must be different from current password" });
    return;
  }

  // Step 4: Hash and update
  const newHash = await hashPassword(body.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Step 5: Terminate all other sessions for security
  await destroyUserSessions(userId);

  // Step 6: Send confirmation email
  if (env.hasSmtp) {
    void enqueueEmail({
      to: user.email,
      subject: "password_change_confirmation",
      template: "password_change_confirmation",
      context: { userName: `${user.firstName} ${user.lastName}` },
    });
  }

  logger.info("Admin changed own password", { userId });
  res.status(200).json({ message: "Password changed successfully. Please login again." });
}

// ──────────────────────────────────────────────
//  POST /api/v1/auth/me/request-email-change
// ──────────────────────────────────────────────

export async function handleRequestEmailChange(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = requestEmailChangeSchema.parse(req.body);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, firstName: true, lastName: true, email: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Step 1: Verify password
  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    res.status(403).json({ error: "Incorrect password" });
    return;
  }

  // Step 2: Check new email is different
  if (user.email.toLowerCase() === body.newEmail.toLowerCase()) {
    res.status(400).json({ error: "New email must be different from current email" });
    return;
  }

  // Step 3: Check new email isn't already in use
  const existing = await prisma.user.findUnique({
    where: { email: body.newEmail.toLowerCase() },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: "This email address is already in use" });
    return;
  }

  // Step 4: Generate OTP and store
  const otp = await createVerificationToken(userId, "EMAIL_CHANGE", body.newEmail.toLowerCase());

  // Step 5: Send OTP to the NEW email address
  if (env.hasSmtp) {
    void enqueueEmail({
      to: body.newEmail,
      subject: "email_change_otp",
      template: "email_change_otp",
      context: {
        userName: `${user.firstName} ${user.lastName}`,
        otp,
        newEmail: body.newEmail,
      },
    });
  }

  logger.info("Email change OTP sent", { userId, newEmail: body.newEmail });
  res.status(200).json({
    message: "Verification code sent to your new email address. It expires in 10 minutes.",
  });
}

// ──────────────────────────────────────────────
//  POST /api/v1/auth/me/verify-email-change
// ──────────────────────────────────────────────

export async function handleVerifyEmailChange(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = verifyEmailChangeSchema.parse(req.body);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Step 1: Verify OTP
  const result = await verifyToken(userId, "EMAIL_CHANGE", body.otp);
  if (!result?.payload) {
    res.status(400).json({ error: "Invalid or expired verification code" });
    return;
  }

  const newEmail = result.payload;
  const oldEmail = user.email;

  // Step 2: Double-check email availability (race condition guard)
  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: "This email address is already in use" });
    return;
  }

  // Step 3: Update email
  await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
  });

  // Step 4: Send confirmation to both old and new email
  if (env.hasSmtp) {
    const userName = `${user.firstName} ${user.lastName}`;
    void enqueueEmail({
      to: oldEmail,
      subject: "email_change_confirmation",
      template: "email_change_confirmation",
      context: { userName, oldEmail, newEmail },
    });
    void enqueueEmail({
      to: newEmail,
      subject: "email_change_confirmation",
      template: "email_change_confirmation",
      context: { userName, oldEmail, newEmail },
    });
  }

  logger.info("Admin email changed", { userId, oldEmail, newEmail });
  res.status(200).json({ message: "Email address updated successfully", email: newEmail });
}

// ──────────────────────────────────────────────
//  PATCH /api/v1/auth/me/mobile
// ──────────────────────────────────────────────

export async function handleUpdateMobile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = updateMobileSchema.parse(req.body);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, firstName: true, lastName: true, email: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Step 1: Verify password
  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    res.status(403).json({ error: "Incorrect password" });
    return;
  }

  // Step 2: Update mobile number
  await prisma.user.update({
    where: { id: userId },
    data: { mobileNumber: body.mobileNumber },
  });

  // Step 3: Send confirmation email
  if (env.hasSmtp) {
    void enqueueEmail({
      to: user.email,
      subject: "mobile_change_confirmation",
      template: "mobile_change_confirmation",
      context: {
        userName: `${user.firstName} ${user.lastName}`,
        newMobile: body.mobileNumber,
      },
    });
  }

  logger.info("Admin mobile number updated", { userId });
  res.status(200).json({ message: "Mobile number updated successfully" });
}
