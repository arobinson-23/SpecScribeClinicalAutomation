/**
 * MFA session cookie — signed with HMAC-SHA-256 using APP_SECRET.
 *
 * The cookie is verified in middleware at Edge runtime (no DB access needed).
 * It binds to the Clerk userId so a stolen cookie cannot be replayed across accounts.
 *
 * Format:  <base64url(JSON payload)>.<base64url(HMAC)>
 * Payload: { uid: clerkUserId, exp: unixSeconds }
 */

import { getAppSecret } from "@/lib/env";

export const MFA_COOKIE_NAME = "ss_mfa";
/** 24 hours — PIPEDA absolute session maximum */
export const MFA_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

type MfaPayload = { uid: string; exp: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBase64Url(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  return new Uint8Array(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)).buffer);
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a signed cookie value that encodes the Clerk userId and a 24-hour
 * expiry. Safe to call in Edge and Node runtimes.
 */
export async function signMfaCookie(clerkUserId: string): Promise<string> {
  const secret = getAppSecret();

  const payload: MfaPayload = {
    uid: clerkUserId,
    exp: Math.floor(Date.now() / 1000) + MFA_COOKIE_MAX_AGE_SEC,
  };

  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));

  return `${payloadB64}.${toBase64Url(sig)}`;
}

/**
 * Returns true only when the cookie value is a valid, unexpired HMAC token
 * bound to the supplied Clerk userId.
 */
export async function verifyMfaCookie(
  cookieValue: string | undefined,
  clerkUserId: string
): Promise<boolean> {
  if (!cookieValue || !clerkUserId) return false;

  let secret: string;
  try {
    secret = getAppSecret();
  } catch {
    return false;
  }

  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const payloadB64 = cookieValue.slice(0, dotIndex);
  const sigB64 = cookieValue.slice(dotIndex + 1);

  try {
    const key = await importKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return false;

    const raw = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(raw) as MfaPayload;

    return payload.uid === clerkUserId && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
