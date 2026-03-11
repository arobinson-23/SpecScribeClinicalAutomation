import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "patients", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { id } = await params;
  const { practiceId, id: userId } = dbUser;

  const patient = await prisma.patient.findFirst({
    where: { id, practiceId, deletedAt: null },
    include: {
      encounters: {
        where: { deletedAt: null },
        orderBy: { encounterDate: "desc" },
        include: {
          provider: { select: { firstName: true, lastName: true, credentials: true } },
          notes: {
            select: { noteType: true, noteFormat: true, finalizedAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!patient) {
    return NextResponse.json(apiErr("Patient not found"), { status: 404 });
  }

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "patient",
    resourceId: id,
    fieldsAccessed: ["firstName", "lastName", "dob", "sex", "phone", "email"],
    metadata: { encounterCount: patient.encounters.length },
  });

  return NextResponse.json(
    apiOk({
      id: patient.id,
      phn: patient.phn,
      firstName: decryptPHISafe(patient.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(patient.lastName) ?? "[encrypted]",
      dob: decryptPHISafe(patient.dob) ?? null,
      sex: patient.sex,
      phone: patient.phone ? decryptPHISafe(patient.phone) : null,
      email: patient.email ? decryptPHISafe(patient.email) : null,
      active: patient.active,
      createdAt: patient.createdAt,
      encounters: patient.encounters.map((e) => ({
        id: e.id,
        encounterDate: e.encounterDate,
        status: e.status,
        specialtyType: e.specialtyType,
        providerName: [
          decryptPHISafe(e.provider.firstName),
          decryptPHISafe(e.provider.lastName),
        ]
          .filter(Boolean)
          .join(" "),
        providerCredentials: e.provider.credentials ?? null,
        noteType: e.notes[0]?.noteType ?? null,
        noteFormat: e.notes[0]?.noteFormat ?? null,
        finalizedAt: e.notes[0]?.finalizedAt ?? null,
      })),
    }),
  );
}
