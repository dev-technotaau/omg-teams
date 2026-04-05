import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { env } from "../config/env.js";

// ──────────────────────────────────────────────
//  AES-256-GCM Password Encryption — §6.3.3
//  For admin-viewable password storage
// ──────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  // Derive a key from the session secret (or a dedicated env var)
  const secret = env.SESSION_SECRET || "default-encryption-key-change-me";
  return scryptSync(secret, "omg-pw-salt", KEY_LENGTH);
}

/**
 * Encrypt a plaintext password for admin retrieval.
 * Returns a base64 string containing: IV + auth tag + ciphertext.
 */
export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: IV (16) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt an encrypted password.
 * Returns the plaintext password.
 */
export function decryptPassword(encrypted: string): string {
  const key = getEncryptionKey();
  const packed = Buffer.from(encrypted, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
