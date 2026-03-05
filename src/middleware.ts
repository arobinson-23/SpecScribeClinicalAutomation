import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyMfaCookie, MFA_COOKIE_NAME } from "@/lib/auth/mfa-cookie";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

const LAST_ACTIVITY_COOKIE = "ss_last_activity";
const SESSION_START_COOKIE = "ss_session_start";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",   // public health check — never redirect
  // TODO(security): "/api/(.*)" exempts all API routes from Clerk middleware-level
  // auth so that each route handler can return a proper JSON 401 rather than an
  // HTML redirect. Each handler gates itself via getDbUser() + hasPermission().
  // When rate limiting is added, implement it here using an Edge-compatible store
  // (e.g. Upstash Redis via @upstash/ratelimit) before the isPublicRoute check,
  // keyed on IP + userId. Target: 100 req/min per user, 20 req/min unauthenticated.
  "/api/(.*)",
  "/pricing(.*)",
  "/demo(.*)",
  "/industry-use(.*)",
]);

/**
 * Authenticated users may visit these routes before the MFA cookie is present.
 * Prevents the redirect loop while the user is completing the MFA step.
 */
const isMfaExempt = createRouteMatcher(["/mfa-verify(.*)"]);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Cookies are stored as `${clerkSessionId}:${unixTimestampMs}` so that
 * stale cookies from a previous Clerk session are ignored automatically
 * when a user signs out and back in again.
 */
function parseCookieTs(
  rawValue: string | undefined,
  currentSessionId: string
): number | null {
  if (!rawValue) return null;
  const colonIndex = rawValue.indexOf(":");
  if (colonIndex === -1) return null;
  const sessionId = rawValue.slice(0, colonIndex);
  if (sessionId !== currentSessionId) return null; // Different session — ignore
  const ts = parseInt(rawValue.slice(colonIndex + 1), 10);
  return isNaN(ts) ? null : ts;
}

function encodeCookieTs(sessionId: string, ts: number): string {
  return `${sessionId}:${ts}`;
}

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionId } = await auth();

  if (!isPublicRoute(request)) {
    if (!userId || !sessionId) {
      await auth.protect();
      return;
    }

    // Enforce idle and absolute timeouts on protected page routes only.
    // API routes are excluded (they're in isPublicRoute) and handle their
    // own auth — a timed-out API call will fail when the session is revoked.
    const now = Date.now();
    const lastActivity = parseCookieTs(
      request.cookies.get(LAST_ACTIVITY_COOKIE)?.value,
      sessionId
    );
    const sessionStart = parseCookieTs(
      request.cookies.get(SESSION_START_COOKIE)?.value,
      sessionId
    );

    const idleExpired =
      lastActivity !== null && now - lastActivity > IDLE_TIMEOUT_MS;
    const absoluteExpired =
      sessionStart !== null && now - sessionStart > ABSOLUTE_TIMEOUT_MS;

    if (idleExpired || absoluteExpired) {
      const reason = absoluteExpired ? "session_expired" : "idle_timeout";
      const timeoutUrl = new URL(
        `/api/auth/session-timeout?reason=${reason}`,
        request.url
      );
      const response = NextResponse.redirect(timeoutUrl);
      response.cookies.delete(LAST_ACTIVITY_COOKIE);
      response.cookies.delete(SESSION_START_COOKIE);
      return response;
    }

    // Require a valid MFA cookie for all protected routes except the MFA
    // verify page itself (which the user visits to acquire the cookie).
    if (!isMfaExempt(request)) {
      const mfaCookie = request.cookies.get(MFA_COOKIE_NAME);
      const mfaValid = await verifyMfaCookie(mfaCookie?.value, userId);
      if (!mfaValid) {
        const dest = new URL("/mfa-verify", request.url);
        dest.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(dest);
      }
    }
  }

  // Stamp activity on every authenticated request so that:
  //  - page navigations reset the idle timer
  //  - background API calls (e.g. audio streaming) also reset the timer
  if (userId && sessionId) {
    const now = Date.now();
    const existingStart = parseCookieTs(
      request.cookies.get(SESSION_START_COOKIE)?.value,
      sessionId
    );

    const response = NextResponse.next();
    response.cookies.set(
      LAST_ACTIVITY_COOKIE,
      encodeCookieTs(sessionId, now),
      COOKIE_OPTIONS
    );
    if (existingStart === null) {
      // First request for this Clerk session — record the absolute start time.
      response.cookies.set(
        SESSION_START_COOKIE,
        encodeCookieTs(sessionId, now),
        COOKIE_OPTIONS
      );
    }
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
