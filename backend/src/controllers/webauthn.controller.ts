import crypto from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { UnauthorizedError } from "../exceptions/unauthorized-error.js";
import { logger } from "../instrument.js";
import { passkeyLogin } from "../services/auth.service.js";
import { isAccountLocked, recordFailedAttempt, lockAccount } from "../services/session.service.js";
import { checkSuspiciousActivity } from "../services/suspicious-activity.service.js";
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  type StoredCredential,
} from "../utils/webauthn.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  WebAuthn / Passkey Controller
// ──────────────────────────────────────────────

const CHALLENGE_TTL = 300; // 5 minutes
const CHALLENGE_PREFIX = "webauthn:challenge:";

/** Helper to store challenge in Redis */
async function storeChallenge(key: string, challenge: string): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`${CHALLENGE_PREFIX}${key}`, CHALLENGE_TTL, challenge);
}

/** Helper to retrieve and delete challenge from Redis */
async function consumeChallenge(key: string): Promise<string | null> {
  const redis = getRedisClient();
  const redisKey = `${CHALLENGE_PREFIX}${key}`;
  const challenge = await redis.get(redisKey);
  if (challenge) {
    await redis.del(redisKey);
  }
  return challenge;
}

/** Convert DB credential to StoredCredential */
function toStoredCredential(cred: {
  credentialId: string;
  credentialPublicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[];
}): StoredCredential {
  return {
    credentialId: cred.credentialId,
    credentialPublicKey: new Uint8Array(cred.credentialPublicKey),
    counter: cred.counter,
    transports: cred.transports,
  };
}

/** Safely extract string param from Express req.params */
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  if (typeof val !== "string") {
    throw new AppError(
      `Missing parameter: ${key}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }
  return val;
}

// ──────────────────────────────────────────────
//  Registration
// ──────────────────────────────────────────────

/** GET /webauthn/register-options — Generate registration options */
export async function handleRegisterOptions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const prisma = getPrisma();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, credentialPublicKey: true, counter: true, transports: true },
  });

  const options = await getRegistrationOptions(
    userId,
    user.email,
    existing.map(toStoredCredential),
  );

  await storeChallenge(`reg:${userId}`, options.challenge);

  res.json({ options });
}

/** POST /webauthn/register — Verify registration response and store credential */
export async function handleRegister(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const prisma = getPrisma();

  const schema = z.object({
    response: z.record(z.string(), z.unknown()),
    deviceName: z.string().max(100).optional(),
  });
  const body = schema.parse(req.body);

  const challenge = await consumeChallenge(`reg:${userId}`);
  if (!challenge) {
    throw new AppError(
      "Challenge expired or not found",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  const verification = await verifyRegistration(body.response, challenge);

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError(
      "WebAuthn registration verification failed",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  const { credential } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []) as string[],
      ...(body.deviceName ? { deviceName: body.deviceName } : {}),
    },
  });

  logger.info("WebAuthn credential registered", { userId });
  res.json({ verified: true });
}

// ──────────────────────────────────────────────
//  Authentication
// ──────────────────────────────────────────────

/** GET /webauthn/authenticate-options — Generate authentication options */
export async function handleAuthenticateOptions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const prisma = getPrisma();

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, credentialPublicKey: true, counter: true, transports: true },
  });

  if (credentials.length === 0) {
    throw new AppError("No passkeys registered", HttpStatus.BAD_REQUEST, ErrorCode.INVALID_INPUT);
  }

  const options = await getAuthenticationOptions(credentials.map(toStoredCredential));

  await storeChallenge(`auth:${userId}`, options.challenge);

  res.json({ options });
}

/** POST /webauthn/authenticate — Verify authentication response */
export async function handleAuthenticate(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const prisma = getPrisma();

  const schema = z.object({
    response: z.record(z.string(), z.unknown()),
  });
  const body = schema.parse(req.body);

  const challenge = await consumeChallenge(`auth:${userId}`);
  if (!challenge) {
    throw new AppError(
      "Challenge expired or not found",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  // Find matching credential by ID from the response
  const credentialId = (body.response as { id?: string }).id;
  if (!credentialId) {
    throw new AppError(
      "Missing credential ID in response",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  const dbCred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
  });

  if (dbCred?.userId !== userId) {
    throw new AppError("Credential not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const verification = await verifyAuthentication(
    body.response,
    challenge,
    toStoredCredential(dbCred),
  );

  if (!verification.verified) {
    throw new AppError(
      "WebAuthn authentication failed",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  // Update counter and lastUsedAt
  await prisma.webAuthnCredential.update({
    where: { credentialId },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  logger.info("WebAuthn authentication successful", { userId, credentialId });
  res.json({ verified: true });
}

// ──────────────────────────────────────────────
//  Passwordless Login (no auth required)
// ──────────────────────────────────────────────

/**
 * POST /webauthn/login-options — Generate authentication options for login.
 * No auth required. Returns a challengeId that must be passed back to /login.
 */
export async function handleLoginOptions(_req: Request, res: Response): Promise<void> {
  // Discoverable credentials (resident keys) — no allowCredentials needed
  const options = await getAuthenticationOptions([]);

  // Store challenge keyed by a unique ID, return that ID alongside options
  const challengeId = crypto.randomBytes(16).toString("hex");
  await storeChallenge(`login:${challengeId}`, options.challenge);

  res.json({ options, challengeId });
}

/**
 * POST /webauthn/login — Verify passkey and create a full session.
 * No auth required. Only handles passkey-specific verification,
 * then delegates to the shared finalizeLogin() via passkeyLogin().
 */
export async function handleLoginVerify(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();

  const schema = z.object({
    response: z.record(z.string(), z.unknown()),
    challengeId: z.string().min(1),
    deviceId: z.string().min(1),
  });
  const body = schema.parse(req.body);

  // Step 1: Retrieve and consume the stored challenge
  const challenge = await consumeChallenge(`login:${body.challengeId}`);
  if (!challenge) {
    throw new AppError(
      "Challenge expired or not found",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  // Step 2: Find the credential by ID from the response
  const credentialId = (body.response as { id?: string }).id;
  if (!credentialId) {
    throw new AppError(
      "Missing credential ID in response",
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    );
  }

  const dbCred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    include: {
      user: {
        select: {
          id: true,
          employeeId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          profilePhotoUrl: true,
          status: true,
          deviceId: true,
        },
      },
    },
  });

  if (!dbCred) {
    throw new UnauthorizedError("Passkey not recognized", ErrorCode.INVALID_CREDENTIALS);
  }

  const user = dbCred.user;

  // Step 3: Account lockout check (before crypto verify, same as password)
  if (await isAccountLocked(user.id)) {
    throw new UnauthorizedError(
      "Account temporarily locked. Contact admin.",
      ErrorCode.ACCOUNT_LOCKED,
    );
  }

  // Step 4: Cryptographic verification (passkey-specific, replaces password verify)
  let verification;
  try {
    verification = await verifyAuthentication(body.response, challenge, toStoredCredential(dbCred));
  } catch {
    const attempts = await recordFailedAttempt(user.id);
    if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
      await lockAccount(user.id);
      void import("../services/notification-triggers.js").then(({ onAccountLockout }) =>
        onAccountLockout(user.id, attempts),
      );
    }
    void checkSuspiciousActivity(user.id);
    throw new UnauthorizedError("Passkey verification failed", ErrorCode.INVALID_CREDENTIALS);
  }

  if (!verification.verified) {
    const attempts = await recordFailedAttempt(user.id);
    if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
      await lockAccount(user.id);
      void import("../services/notification-triggers.js").then(({ onAccountLockout }) =>
        onAccountLockout(user.id, attempts),
      );
    }
    void checkSuspiciousActivity(user.id);
    throw new UnauthorizedError("Passkey verification failed", ErrorCode.INVALID_CREDENTIALS);
  }

  // Update credential counter + lastUsedAt
  await prisma.webAuthnCredential.update({
    where: { credentialId },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  // Steps 5-9: Delegate to shared auth flow (status, device, session, cookies, log, GA4)
  const result = await passkeyLogin(
    {
      user,
      deviceId: body.deviceId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
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

  logger.info("Passkey login successful", { userId: user.id, credentialId });

  // Non-admin auto punch-in (same as handleLogin in auth.controller)
  if (result.user.role !== "ADMIN") {
    void import("../services/attendance.service.js").then(({ punchIn }) => punchIn(result.user.id));
  }

  res.json({
    user: result.user,
    sessionId: result.session.sessionId,
  });
}

// ──────────────────────────────────────────────
//  Credential Management
// ──────────────────────────────────────────────

/** GET /webauthn/credentials — List user's registered passkeys */
export async function handleListCredentials(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const prisma = getPrisma();

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: {
      id: true,
      credentialId: true,
      deviceName: true,
      transports: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ credentials });
}

/** PATCH /webauthn/credentials/:id — Rename a passkey */
export async function handleRenameCredential(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const id = getParam(req, "id");
  const prisma = getPrisma();

  const schema = z.object({ deviceName: z.string().min(1).max(100) });
  const { deviceName } = schema.parse(req.body);

  const cred = await prisma.webAuthnCredential.findUnique({ where: { id } });
  if (cred?.userId !== userId) {
    throw new AppError("Credential not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  await prisma.webAuthnCredential.update({
    where: { id },
    data: { deviceName },
  });

  res.json({ success: true });
}

/** DELETE /webauthn/credentials/:id — Remove a passkey */
export async function handleDeleteCredential(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const id = getParam(req, "id");
  const prisma = getPrisma();

  const cred = await prisma.webAuthnCredential.findUnique({ where: { id } });
  if (cred?.userId !== userId) {
    throw new AppError("Credential not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  await prisma.webAuthnCredential.delete({ where: { id } });

  logger.info("WebAuthn credential deleted", { userId, credentialId: cred.credentialId });
  res.json({ success: true });
}
