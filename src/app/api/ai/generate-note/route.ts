import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI, hashSHA256 } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { generateClinicalNote } from "@/lib/ai/anthropic";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

/**
 * PIPEDA & HIA Compliance Note:
 * This route handles PHI in transit to AI. Audit logs must capture the 
 * exact AI model and parameters for forensic accountability. 
 * Data residency is managed at the orchestration layer.
 */

const schema = z.object({
  encounterId: z.string().uuid(),
  transcript: z.string().min(10),
  noteType: z.enum(["progress_note", "intake", "biopsychosocial", "treatment_plan", "procedure", "consultation", "discharge"]),
  noteFormat: z.enum(["SOAP", "DAP", "BIRP", "NARRATIVE"]),
  patientContext: z.object({
    ageYears: z.number().optional(),
    biologicalSex: z.string().optional(),
    priorDiagnoses: z.array(z.string()).optional(),
    currentMedications: z.array(z.string()).optional(),
    chiefComplaint: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true },
  });
  if (!dbUser) return NextResponse.json(apiErr("User records not synchronized"), { status: 403 });

  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { encounterId, transcript, noteType, noteFormat, patientContext } = parsed.data;

  // Verify encounter belongs to this practice
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  // Update status
  await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "ai_processing" },
  });

  const start = Date.now();

  const result = await generateClinicalNote(
    { encounterId, transcript, noteType: noteType as never, noteFormat: noteFormat as never, patientContext },
    encounter.specialtyType,
    noteFormat as never,
    encounterId,
  );

  // Store encrypted transcript + generated note
  const encryptedTranscript = encryptPHI(transcript);
  const encryptedNote = encryptPHI(result.note);

  const note = await prisma.encounterNote.upsert({
    where: {
      // Find existing note for this encounter+type
      id: (await prisma.encounterNote.findFirst({ where: { encounterId, noteType: noteType as never } }))?.id ?? "new",
    },
    create: {
      encounterId,
      noteType: noteType as never,
      noteFormat: noteFormat as never,
      rawTranscript: encryptedTranscript,
      aiGeneratedNote: encryptedNote,
      wordCount: result.wordCount,
    },
    update: {
      rawTranscript: encryptedTranscript,
      aiGeneratedNote: encryptedNote,
      wordCount: result.wordCount,
      finalizedAt: null,
    },
  });

  // Log AI interaction
  await prisma.aIInteraction.create({
    data: {
      encounterId,
      interactionType: "note_generation",
      promptHash: hashSHA256(transcript),
      outputHash: hashSHA256(result.note),
      modelVersion: result.modelVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
    },
  });

  await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "needs_review" },
  });

  await writeAuditLog({
    practiceId,
    userId,
    action: "AI_INVOCATION",
    resource: "encounter_note",
    resourceId: note.id,
    metadata: {
      interactionType: "note_generation",
      latencyMs: Date.now() - start,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      complianceStandard: "PIPEDA/HIA Zero-Retention",
      modelVersion: result.modelVersion,
    },
  });

  // Return decrypted note to provider for review (never log this)
  return NextResponse.json(
    apiOk({
      noteId: note.id,
      note: result.note,
      wordCount: result.wordCount,
      modelVersion: result.modelVersion,
      latencyMs: result.latencyMs,
    })
  );
}
