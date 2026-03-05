import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import { signMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_MAX_AGE_SEC } from "@/lib/auth/mfa-cookie";
import { verifyBackupCode } from "@/lib/auth/backup-codes";
import {
  checkMfaRateLimit,
  recordMfaFailure,
  clearMfaAttempts,
} from "@/lib/auth/mfa-rate-limit";
import { z } from "zod";
import { apiErr, apiOk } from "@/types/api";

const schema = z.object({ code: z.string().length(8) });

/**
 * POST /api/auth/mfa/backup-code
 * Verifies a one-time MFA backup code, removes it from the user's list,
 * and issues the MFA session cookie.
 */
export async function POST(req: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  // ── Rate limit — shared with the TOTP verify endpoint ─────────────────────
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
    return NextResponse.json(apiErr("Backup codes are 8 characters"), { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: { mfaEnabled: true, mfaBackupCodes: true },
  });

  if (!user?.mfaEnabled) {
    return NextResponse.json(apiErr("MFA not configured"), { status: 400 });
  }

  const result = verifyBackupCode(parsed.data.code, user.mfaBackupCodes);

  if (!result.valid) {
    await recordMfaFailure(dbUser.id, dbUser.practiceId);
    await writeAuditLog({
      practiceId: dbUser.practiceId,
      userId: dbUser.id,
      action: "MFA_VERIFY",
      resource: "user",
      resourceId: dbUser.id,
      outcome: "failure",
      metadata: { method: "backup_code" },
    });
    return NextResponse.json(apiErr("Invalid backup code"), { status: 401 });
  }

  // Remove the used code — backup codes are one-time-use
  const updatedCodes = (user.mfaBackupCodes as string[]).filter(
    (h) => h !== result.matchedHash
  );

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { mfaBackupCodes: updatedCodes },
  });

  clearMfaAttempts(dbUser.id);

  await writeAuditLog({
    practiceId: dbUser.practiceId,
    userId: dbUser.id,
    action: "MFA_VERIFY",
    resource: "user",
    resourceId: dbUser.id,
    outcome: "success",
    metadata: { method: "backup_code", remainingBackupCodes: updatedCodes.length },
  });

  const cookieValue = await signMfaCookie(clerkUser.id);

  const response = NextResponse.json(
    apiOk({ success: true, remainingBackupCodes: updatedCodes.length })
  );
  response.cookies.set(MFA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MFA_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
