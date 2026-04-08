import axios from "axios";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  WebAuthn / Passkey Service
// ──────────────────────────────────────────────

export interface WebAuthnCredential {
  id: string;
  credentialId: string;
  deviceName: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

/** Get registration options (challenge) from server */
export async function getRegisterOptions() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await api.get<{ options: any }>("/webauthn/register-options");
  return res.data.options;
}

/** Send registration response to server for verification */
export async function registerCredential(response: Record<string, unknown>, deviceName?: string) {
  const res = await api.post<{ verified: boolean }>("/webauthn/register", { response, deviceName });
  return res.data;
}

/** Get authentication options (challenge) from server */
export async function getAuthenticateOptions() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await api.get<{ options: any }>("/webauthn/authenticate-options");
  return res.data.options;
}

/** Send authentication response to server for verification */
export async function authenticateCredential(response: Record<string, unknown>) {
  const res = await api.post<{ verified: boolean }>("/webauthn/authenticate", { response });
  return res.data;
}

/** List all registered passkeys */
export async function listCredentials() {
  const res = await api.get<{ credentials: WebAuthnCredential[] }>("/webauthn/credentials");
  return res.data.credentials;
}

/** Rename a passkey */
export async function renameCredential(id: string, deviceName: string) {
  const res = await api.patch<{ success: boolean }>(`/webauthn/credentials/${id}`, { deviceName });
  return res.data;
}

/** Delete a passkey */
export async function deleteCredential(id: string) {
  await api.delete(`/webauthn/credentials/${id}`);
}

// ──────────────────────────────────────────────
//  Passwordless Login (no auth required — uses BFF route)
// ──────────────────────────────────────────────

/** Get login options (challenge) — no auth required, goes through BFF */
export async function getLoginOptions() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await axios.post<{ options: any; challengeId: string }>(
    "/api/auth/webauthn-options",
    {},
  );
  return res.data;
}

/** Verify passkey login — no auth required, goes through BFF */
export async function loginWithPasskey(
  response: Record<string, unknown>,
  challengeId: string,
  deviceId: string,
  /** Admin session-conflict bypass — see backend auth.service.ts LoginInput */
  confirmReplaceSession?: boolean,
) {
  const res = await axios.post<{ user: { role: string }; sessionId: string }>(
    "/api/auth/webauthn-login",
    {
      response,
      challengeId,
      deviceId,
      ...(confirmReplaceSession === true && { confirmReplaceSession: true }),
    },
  );
  return res.data;
}

// ──────────────────────────────────────────────
//  Browser WebAuthn API helpers
// ──────────────────────────────────────────────

/** Check if WebAuthn is supported in this browser */
export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

/** Check if conditional mediation (autofill) is available */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}
