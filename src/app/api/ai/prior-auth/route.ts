import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHI } from "@/lib/db/encryption";
import { generatePriorAuthSummary } from "@/lib/ai/anthropic";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const schema = z.object({
  encounterId: z.string().uuid(),
  payerName: z.string().min(1),
  payerId: z.string().optional(),
  procedureCodes: z.array(z.string()).min(1),
  diagnosisCodes: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "prior_auth", "create")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId } = dbUser;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { encounterId, payerName, payerId, procedureCodes, diagnosisCodes } = parsed.data;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    include: { notes: true },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  const latestNote = encounter.notes[encounter.notes.length - 1];
  if (!latestNote) return NextResponse.json(apiErr("No clinical note found for this encounter"), { status: 400 });

  const noteText = latestNote.providerEditedNote
    ? decryptPHI(latestNote.providerEditedNote)
    : latestNote.aiGeneratedNote
      ? decryptPHI(latestNote.aiGeneratedNote)
      : null;

  if (!noteText) return NextResponse.json(apiErr("Note content is empty"), { status: 400 });

  const result = await generatePriorAuthSummary({
    payerName,
    procedureCodes,
    diagnosisCodes,
    clinicalNote: noteText,
    encounterId,
  });

  // Create or update the prior auth request
  const priorAuth = await prisma.priorAuthRequest.create({
    data: {
      practiceId,
      encounterId,
      payerId: payerId ?? payerName.toLowerCase().replace(/\s/g, "_"),
      payerName,
      procedureCodes,
      diagnosisCodes,
      status: "pending_submission",
      clinicalSummary: encryptPHI(result.clinicalSummary),
    },
  });

  await writeAuditLog({
    practiceId,
    userId,
    action: "AI_INVOCATION",
    resource: "prior_auth_request",
    resourceId: priorAuth.id,
    metadata: {
      interactionType: "prior_auth",
      payerName,
      complianceStandard: "HIA (Alberta) / PIPEDA",
      providerAttestationRequired: true
    },
  });

  return NextResponse.json(
    apiOk({
      priorAuthId: priorAuth.id,
      clinicalSummary: result.clinicalSummary,
      medicalNecessityStatement: result.medicalNecessityStatement,
      missingDocumentation: result.missingDocumentation,
    }),
    { status: 201 }
  );
}
