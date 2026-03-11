import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: encounterId } = await params;
    const dbUser = await getDbUser();
    if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patient: true,
        provider: true,
        notes: { orderBy: { createdAt: "desc" } },
        codes: true,
      },
    });

    if (!encounter || encounter.practiceId !== dbUser.practiceId) {
      return NextResponse.json(apiErr("Encounter not found"), { status: 404 });
    }

    // Defensive construction of the response object
    const result = {
      ...encounter,
      patient: {
        ...encounter.patient,
        firstName: decryptPHISafe(encounter.patient.firstName) || "Patient",
        lastName: decryptPHISafe(encounter.patient.lastName) || "Name",
      },
      provider: {
        ...encounter.provider,
        firstName: decryptPHISafe(encounter.provider.firstName) || "Provider",
        lastName: decryptPHISafe(encounter.provider.lastName) || "Scribe",
      },
      notes: encounter.notes.map(n => ({
        ...n,
        aiGeneratedNote: n.aiGeneratedNote ? (decryptPHISafe(n.aiGeneratedNote) || "Note content unavailable") : null,
        providerEditedNote: n.providerEditedNote ? (decryptPHISafe(n.providerEditedNote) || "Edited content unavailable") : null,
      }))
    };

    return NextResponse.json(apiOk(result));
  } catch (e: any) {
    console.error("[API-ENCOUNTER-GET] DEFENSIVE CRASH:", e);
    return NextResponse.json(apiErr(e.message || "Internal Server Error"), { status: 500 });
  }
}

const PatchEncounterSchema = z.object({
  status: z.enum(["not_started", "in_progress", "ai_processing", "needs_review", "note_finalized", "finalized"]),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "own_encounters", "update")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { id: encounterId } = await params;
  const { practiceId, id: userId } = dbUser;

  const body = await req.json().catch(() => null);
  const parsed = PatchEncounterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiErr("Invalid input: " + parsed.error.message), { status: 400 });
  }

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  const updated = await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    userId,
    practiceId,
    action: "UPDATE",
    resource: "encounter",
    resourceId: encounterId,
    metadata: {
      fieldsChanged: ["status"],
      newStatus: parsed.data.status,
    },
  });

  return NextResponse.json(apiOk(updated));
}
