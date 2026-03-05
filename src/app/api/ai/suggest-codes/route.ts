import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHI, hashSHA256 } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { suggestCodes } from "@/lib/ai/anthropic";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const schema = z.object({
  encounterId: z.string().uuid(),
  noteId: z.string().uuid(),
  payerRules: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "coding", "create")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: userId } = dbUser;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { encounterId, noteId, payerRules } = parsed.data;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  const note = await prisma.encounterNote.findFirst({
    where: { id: noteId, encounterId },
  });
  if (!note) return NextResponse.json(apiErr("Note not found"), { status: 404 });

  // Decrypt the finalized note
  const noteText = note.providerEditedNote
    ? decryptPHI(note.providerEditedNote)
    : note.aiGeneratedNote
      ? decryptPHI(note.aiGeneratedNote)
      : null;

  if (!noteText) return NextResponse.json(apiErr("No note content to analyze"), { status: 400 });

  const result = await suggestCodes({
    note: noteText,
    specialty: encounter.specialtyType,
    encounterId,
    payerRules,
  });

  // Determine the next version number across all batches for this encounter
  // (includes superseded rows so the counter is monotonically increasing).
  const { _max } = await prisma.encounterCode.aggregate({
    where: { encounterId },
    _max: { version: true },
  });
  const nextVersion = (_max.version ?? 0) + 1;

  // Supersede pending AI suggestions rather than deleting them.
  // Only un-reviewed rows (providerAccepted IS NULL) are superseded;
  // provider decisions (accepted/rejected) are permanent and never removed.
  const supersededAt = new Date();
  await prisma.encounterCode.updateMany({
    where: { encounterId, providerAccepted: null, supersededAt: null },
    data: { supersededAt },
  });

  await prisma.encounterCode.createMany({
    data: result.suggestions.map((s) => ({
      encounterId,
      codeType: s.codeType,
      code: s.code,
      description: s.description,
      modifier: s.modifier,
      units: s.units,
      aiConfidence: s.confidence,
      aiRationale: s.rationale,
      version: nextVersion,
    })),
  });

  await prisma.aIInteraction.create({
    data: {
      encounterId,
      interactionType: "coding",
      promptHash: hashSHA256(noteText),
      outputHash: hashSHA256(JSON.stringify(result.suggestions)),
      modelVersion: result.modelVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
    },
  });

  await writeAuditLog({
    practiceId,
    userId,
    action: "AI_INVOCATION",
    resource: "encounter_codes",
    resourceId: encounterId,
    metadata: {
      interactionType: "coding",
      suggestionCount: result.suggestions.length,
      complianceStandard: "HIA (Alberta) / PIPEDA",
      serviceCodeSet: "AHCIP (Alberta) / AMA SOMB (Alberta Medical Association Schedule of Medical Benefits)"
    },
  });

  return NextResponse.json(apiOk(result));
}
