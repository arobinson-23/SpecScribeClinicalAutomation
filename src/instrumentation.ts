/**
 * Next.js instrumentation hook — executed once per server worker on startup.
 *
 * Validates critical environment variables early so configuration errors
 * surface at boot time rather than at the first request that touches PHI
 * encryption or MFA cookie signing.
 *
 * Restricted to the Node.js runtime so the Edge bundle stays clean of the
 * import. The Edge runtime's own calls to getAppSecret() inside
 * mfa-cookie.ts will still throw on the first request if the secret is bad.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getAppSecret } = await import("@/lib/env");
    // Throws with a clear, actionable message if the secret is absent,
    // weak, or insufficiently long. Kills the worker before any request
    // is served, preventing silent data-loss from an invalid DEK.
    getAppSecret();
  }
}
