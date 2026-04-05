import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";
import { env } from "../config/env.js";

// ──────────────────────────────────────────────
//  WebAuthn / Passkey Utilities
// ──────────────────────────────────────────────

const RP_NAME = env.WEBAUTHN_RP_NAME;
const RP_ID = env.WEBAUTHN_RP_ID;
const ORIGIN = env.FRONTEND_URL;

export interface StoredCredential {
  credentialId: string;
  credentialPublicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: string[] | undefined;
}

export async function getRegistrationOptions(
  userId: string,
  userName: string,
  existingCredentials: StoredCredential[] = [],
): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: RP_NAME,
    rpID: RP_ID,
    userName,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  };

  if (existingCredentials.length > 0) {
    opts.excludeCredentials = existingCredentials.map((cred) => ({
      id: cred.credentialId,
    }));
  }

  return generateRegistrationOptions(opts);
}

export async function verifyRegistration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  expectedChallenge: string,
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });
}

export async function getAuthenticationOptions(
  allowCredentials: StoredCredential[] = [],
): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: RP_ID,
    userVerification: "preferred",
  };

  if (allowCredentials.length > 0) {
    opts.allowCredentials = allowCredentials.map((cred) => ({
      id: cred.credentialId,
    }));
  }

  return generateAuthenticationOptions(opts);
}

export async function verifyAuthentication(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  expectedChallenge: string,
  credential: StoredCredential,
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.credentialId,
      publicKey: credential.credentialPublicKey,
      counter: credential.counter,
    },
  });
}
