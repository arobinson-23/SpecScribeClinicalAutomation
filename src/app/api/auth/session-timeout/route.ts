import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/session-timeout?reason=idle_timeout|session_expired
 *
 * Called by middleware when the 15-minute idle timer or 24-hour absolute
 * session limit is breached. Revokes the active Clerk session server-side
 * so the browser cannot use it again, then redirects to /sign-in with the
 * reason attached for display.
 *
 * This route is under /api/ (a public matcher) so middleware never redirects
 * it in a loop.
 */
export async function GET(request: NextRequest) {
  const { sessionId } = await auth();
  const reason = request.nextUrl.searchParams.get("reason") ?? "session_expired";

  if (sessionId) {
    try {
      const clerk = await clerkClient();
      await clerk.sessions.revokeSession(sessionId);
    } catch {
      // Best-effort — session may already be expired or revoked by Clerk.
    }
  }

  const signInUrl = new URL(`/sign-in?reason=${reason}`, request.url);
  return NextResponse.redirect(signInUrl, { status: 302 });
}
