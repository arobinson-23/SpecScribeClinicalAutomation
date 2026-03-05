import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "own_encounters", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { id: encounterId } = await params;
  const { practiceId, id: userId } = dbUser;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    include: {
      patient: { select: { mrn: true, firstName: true, lastName: true } },
      provider: { select: { firstName: true, lastName: true, credentials: true } },
      notes: {
        select: {
          id: true,
          noteType: true,
          noteFormat: true,
          aiGeneratedNote: true,
          finalizedAt: true,
          wordCount: true,
        },
        orderBy: { createdAt: "desc" },
      },
      codes: {
        select: {
          id: true,
          code: true,
          codeType: true,
          description: true,
          modifier: true,
          aiConfidence: true,
          providerAccepted: true,
        },
        orderBy: [{ codeType: "asc" }, { aiConfidence: "desc" }],
      },
    },
  });

  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  // Decrypt PHI fields — build response without spread to satisfy strict Prisma types
  const result = {
    id: encounter.id,
    practiceId: encounter.practiceId,
    status: encounter.status,
    specialtyType: encounter.specialtyType,
    encounterDate: encounter.encounterDate,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    patient: {
      mrn: encounter.patient.mrn,
      firstName: decryptPHISafe(encounter.patient.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(encounter.patient.lastName) ?? "[encrypted]",
    },
    provider: {
      credentials: encounter.provider.credentials,
      firstName: decryptPHISafe(encounter.provider.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(encounter.provider.lastName) ?? "[encrypted]",
    },
    notes: encounter.notes.map((n) => ({
      id: n.id,
      noteType: n.noteType,
      noteFormat: n.noteFormat,
      aiGeneratedNote: n.aiGeneratedNote ? (decryptPHISafe(n.aiGeneratedNote) ?? null) : null,
      finalizedAt: n.finalizedAt,
      wordCount: n.wordCount,
    })),
    codes: encounter.codes,
  };

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "encounter",
    resourceId: encounterId,
    fieldsAccessed: ["id", "status", "notes", "codes", "patient", "provider"],
  });

  return NextResponse.json(apiOk(result));
}
