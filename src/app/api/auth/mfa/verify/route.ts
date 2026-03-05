import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { decryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { signMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_MAX_AGE_SEC } from "@/lib/auth/mfa-cookie";
import {
  checkMfaRateLimit,
  recordMfaFailure,
  clearMfaAttempts,
} from "@/lib/auth/mfa-rate-limit";
import { authenticator } from "otplib";
import { z } from "zod";
import { apiErr, apiOk } from "@/types/api";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  // ── Rate limit check ───────────────────────────────────────────────────────
  const rateCheck = checkMfaRateLimit(dbUser.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      apiErr("Too many failed attempts — try again later"),
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiErr("Invalid code format"), { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: { mfaSecret: true, mfaEnabled: true },
  });

  if (!user?.mfaSecret || !user.mfaEnabled) {
    return NextResponse.json(apiErr("MFA not configured"), { status: 400 });
  }

  const secret = decryptPHI(user.mfaSecret);
  const isValid = authenticator.check(parsed.data.code, secret);

  if (!isValid) {
    await recordMfaFailure(dbUser.id, dbUser.practiceId);
  } else {
    clearMfaAttempts(dbUser.id);
  }

  await writeAuditLog({
    practiceId: dbUser.practiceId,
    userId: dbUser.id,
    action: "MFA_VERIFY",
    resource: "user",
    resourceId: dbUser.id,
    outcome: isValid ? "success" : "failure",
  });

  if (!isValid) {
    return NextResponse.json(apiErr("Invalid or expired code"), { status: 401 });
  }

  // Issue MFA cookie bound to the Clerk session user
  const cookieValue = await signMfaCookie(clerkUser.id);

  const response = NextResponse.json(apiOk({ success: true }));
  response.cookies.set(MFA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MFA_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
