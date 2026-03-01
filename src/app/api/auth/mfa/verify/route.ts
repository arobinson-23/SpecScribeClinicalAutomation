import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { decryptPHI } from "@/lib/db/encryption";
import { authenticator } from "otplib";
import { z } from "zod";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as unknown as { userId: string }).userId;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code format" }, { status: 400 });

  const { code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: "MFA not configured" }, { status: 400 });
  }

  const secret = decryptPHI(user.mfaSecret);
  const isValid = authenticator.check(code, secret);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // In a real app, you would update the JWT to include mfa_verified: true
  // This requires updating the session — for Next-Auth you'd use the update() call
  // or a custom session update endpoint

  return NextResponse.json({ success: true });
}
