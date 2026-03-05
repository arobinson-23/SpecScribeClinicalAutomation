import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import { decryptPHISafe } from "@/lib/db/encryption";
import {
  getPracticeVerificationStatus,
  getCollegeForProvince,
} from "@/lib/compliance/oig-screening";
import { apiOk, apiErr } from "@/types/api";

const PostBodySchema = z.object({
  userId: z.string().uuid(),
  inGoodStanding: z.boolean(),
  registrationNumber: z.string().min(1),
  province: z.string().length(2),
  notes: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "compliance", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId, role } = dbUser;

  const verificationStatus = await getPracticeVerificationStatus(practiceId);

  // Decrypt provider names before sending to client; serialize Dates to ISO strings
  const providers = verificationStatus.providers.map((p) => ({
    userId: p.userId,
    firstName: decryptPHISafe(p.firstName),
    lastName: decryptPHISafe(p.lastName),
    credentials: p.credentials,
    provincialRegistrationNumber: p.provincialRegistrationNumber,
    province: p.province,
    registrationNumber: p.registrationNumber,
    college: p.college,
    registerUrl: p.registerUrl,
    status: p.status,
    latestVerification: p.latestVerification
      ? {
          id: p.latestVerification.id,
          verifiedAt: p.latestVerification.verifiedAt.toISOString(),
          expiresAt: p.latestVerification.expiresAt.toISOString(),
          inGoodStanding: p.latestVerification.inGoodStanding,
          notes: p.latestVerification.notes,
        }
      : null,
  }));

  await writeAuditLog({
    practiceId,
    userId,
    userRole: role,
    action: "READ",
    resource: "provider_verification",
    outcome: "success",
    fieldsAccessed: ["firstName", "lastName", "registrationNumber"],
  });

  return NextResponse.json(
    apiOk({ ...verificationStatus, providers }),
  );
}

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "compliance", "create")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: verifiedById, role } = dbUser;

  const body: unknown = await req.json();
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiErr(parsed.error.message), { status: 422 });
  }

  const { userId, inGoodStanding, registrationNumber, province, notes } = parsed.data;

  // Multi-tenant isolation: target user must belong to same practice
  const targetUser = await prisma.user.findFirst({
    where: { id: userId, practiceId, deletedAt: null },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json(apiErr("User not found"), { status: 404 });
  }

  const collegeInfo = getCollegeForProvince(province);
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + 365 * 24 * 60 * 60 * 1000);

  const verification = await prisma.providerVerification.create({
    data: {
      practiceId,
      userId,
      verifiedById,
      province,
      registrationNumber,
      college: collegeInfo.college,
      inGoodStanding,
      verifiedAt,
      expiresAt,
      notes,
    },
  });

  if (!inGoodStanding) {
    await prisma.complianceAlert.create({
      data: {
        practiceId,
        alertType: "provider_college_standing",
        severity: "critical",
        title: "Provider Not in Good Standing",
        description: `Provider (userId: ${userId}) is not in good standing with ${collegeInfo.college}. Immediate review required.`,
        entityType: "user",
        entityId: userId,
      },
    });
  }

  await writeAuditLog({
    practiceId,
    userId: verifiedById,
    userRole: role,
    action: "CREATE",
    resource: "provider_verification",
    resourceId: verification.id,
    outcome: "success",
    fieldsChanged: ["inGoodStanding", "registrationNumber", "province"],
  });

  return NextResponse.json(apiOk({ verification }));
}
