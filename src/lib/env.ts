/**
 * APP_SECRET validation — Edge & Node.js compatible (uses only Web APIs).
 *
 * APP_SECRET is used for:
 *  - AES-256-GCM data-encryption key (DEK) derivation for PHI at rest
 *  - HMAC-SHA-256 signing of MFA session cookies
 *
 * Minimum requirement: 32 bytes (256 bits) of cryptographic entropy.
 * Recommended: 64 lower-case hex chars from `openssl rand -hex 32`.
 */

const MIN_ENTROPY_BYTES = 32;

/**
 * Known-weak values that should never reach production. Stored lower-cased
 * so the comparison is case-insensitive.
 */
const WEAK_PATTERNS = new Set([
  "secret",
  "password",
  "changeme",
  "test",
  "dev",
  "development",
  "placeholder",
  "specscribe",
  "yoursecret",
  "mysecret",
  // All-zero and all-F hex strings have zero entropy
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
]);

/**
 * Estimates the byte-length of cryptographic material encoded in `value`.
 * Handles hex (most common), base64 / base64url, and raw UTF-8 strings.
 */
function estimateEntropyBytes(value: string): number {
  const v = value.trim();

  if (/^[0-9a-f]+$/i.test(v) && v.length % 2 === 0) {
    // Hex-encoded — 2 chars per byte
    return v.length / 2;
  }

  if (/^[A-Za-z0-9+/\-_]+=*$/.test(v)) {
    // Base64 / base64url — 4 chars ≈ 3 bytes
    const unpadded = v.replace(/=+$/, "");
    return Math.floor((unpadded.length * 3) / 4);
  }

  // Raw string — count UTF-8 bytes
  return new TextEncoder().encode(v).length;
}

// Module-level cache so validation only runs once per worker lifetime.
let cachedSecret: string | undefined;

/**
 * Returns the validated APP_SECRET string.
 *
 * Throws a descriptive error if the secret is:
 *  - absent / empty
 *  - a known-weak placeholder
 *  - shorter than 256 bits of key material
 *
 * Safe to call in both Edge and Node.js runtimes.
 */
export function getAppSecret(): string {
  if (cachedSecret !== undefined) return cachedSecret;

  const raw = process.env.APP_SECRET?.trim();

  if (!raw) {
    throw new Error(
      "[SpecScribe] APP_SECRET is not set.\n" +
        "  Generate a secure value with:  openssl rand -hex 32\n" +
        "  Then add it to .env.local as:  APP_SECRET=<value>"
    );
  }

  if (WEAK_PATTERNS.has(raw.toLowerCase())) {
    throw new Error(
      "[SpecScribe] APP_SECRET is a known-weak placeholder value.\n" +
        "  Generate a secure value with:  openssl rand -hex 32"
    );
  }

  const entropyBytes = estimateEntropyBytes(raw);
  if (entropyBytes < MIN_ENTROPY_BYTES) {
    throw new Error(
      `[SpecScribe] APP_SECRET provides only ~${entropyBytes} bytes of key material ` +
        `but AES-256-GCM requires at least ${MIN_ENTROPY_BYTES} bytes (256 bits).\n` +
        "  Generate a secure value with:  openssl rand -hex 32"
    );
  }

  cachedSecret = raw;
  return cachedSecret;
}
