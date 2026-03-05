/**
 * MFA backup code utilities.
 *
 * Codes are stored as HMAC-SHA256 hashes keyed by APP_SECRET.
 * This makes hashes uncrackable without the server secret even if
 * the database is compromised independently.
 *
 * Format: 8 uppercase alphanumeric chars from an unambiguous character set
 * (no 0/O, 1/I, L to avoid transcription errors).
 * Entropy: ~40 bits (32^8 combinations) — sufficient for rate-limited one-time-use codes.
 */

import { randomBytes, createHmac } from "crypto";
import { getAppSecret } from "@/lib/env";

/** Unambiguous characters for human-readable backup codes. */
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Generates `count` cryptographically random backup codes in plain text. */
export function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(CODE_LENGTH);
    return Array.from(bytes)
      .map((b) => CHARS[b % CHARS.length])
      .join("");
  });
}

/**
 * Returns the HMAC-SHA256 hex digest of a backup code.
 * Used for storage and comparison — never log or return the plain code after setup.
 */
export function hashBackupCode(plainCode: string): string {
  return createHmac("sha256", getAppSecret())
    .update(plainCode.toUpperCase().trim())
    .digest("hex");
}

/**
 * Returns true if `submittedCode` matches any hash in `storedHashes`,
 * and returns the matched hash so it can be removed (one-time use).
 */
export function verifyBackupCode(
  submittedCode: string,
  storedHashes: unknown
): { valid: false } | { valid: true; matchedHash: string } {
  if (!Array.isArray(storedHashes) || storedHashes.length === 0) {
    return { valid: false };
  }

  const submittedHash = hashBackupCode(submittedCode);

  for (const stored of storedHashes) {
    if (typeof stored === "string" && stored === submittedHash) {
      return { valid: true, matchedHash: stored };
    }
  }

  return { valid: false };
}
