import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { signMfaCookie, MFA_COOKIE_NAME, MFA_COOKIE_MAX_AGE_SEC } from "@/lib/auth/mfa-cookie";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { apiErr, apiOk } from "@/types/api";
import { generateBackupCodes, hashBackupCode } from "@/lib/auth/backup-codes";

const ConfirmSchema = z.object({ code: z.string().length(6) });

/**
 * GET /api/auth/mfa/setup
 * Generates (or re-fetches) a pending TOTP secret and returns a QR code.
 * Does NOT set mfaEnabled — that happens on successful POST.
 */
export async function GET() {
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  if (user.mfaEnabled) {
    return NextResponse.json(apiErr("MFA_ALREADY_ENABLED"), { status: 409 });
  }

  // Reuse any pending secret so repeated page loads get the same QR code.
  const secret = user.mfaSecret
    ? decryptPHI(user.mfaSecret)
    : authenticator.generateSecret();

  if (!user.mfaSecret) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { mfaSecret: encryptPHI(secret) },
    });
  }

  const otpAuthUrl = authenticator.keyuri(dbUser.email, "SpecScribe", secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

  return NextResponse.json(apiOk({ qrDataUrl, secret }));
}

/**
 * POST /api/auth/mfa/setup
 * Confirms the TOTP code, activates MFA on the user, and sets the MFA cookie.
 */
export async function POST(req: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiErr("Invalid code format"), { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  if (user.mfaEnabled) {
    return NextResponse.json(apiErr("MFA_ALREADY_ENABLED"), { status: 409 });
  }
  if (!user.mfaSecret) {
    return NextResponse.json(apiErr("MFA_SETUP_NOT_STARTED"), { status: 400 });
  }

  const secret = decryptPHI(user.mfaSecret);
  const isValid = authenticator.check(parsed.data.code, secret);

  await writeAuditLog({
    practiceId: dbUser.practiceId,
    userId: dbUser.id,
    action: "MFA_SETUP",
    resource: "user",
    resourceId: dbUser.id,
    outcome: isValid ? "success" : "failure",
  });

  if (!isValid) {
    return NextResponse.json(apiErr("Invalid or expired code"), { status: 401 });
  }

  // Generate 10 one-time backup codes; store as HMAC-SHA256 hashes.
  const plainCodes = generateBackupCodes(10);
  const hashedCodes = plainCodes.map(hashBackupCode);

  // Activate MFA and persist hashed backup codes
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      mfaEnabled: true,
      mfaBackupCodes: hashedCodes,
    },
  });

  // Issue MFA cookie so the user doesn't have to verify again this session
  const cookieValue = await signMfaCookie(clerkUser.id);

  // Return plain codes once — provider must save them now; they cannot be retrieved again.
  const response = NextResponse.json(apiOk({ success: true, backupCodes: plainCodes }));
  response.cookies.set(MFA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MFA_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
