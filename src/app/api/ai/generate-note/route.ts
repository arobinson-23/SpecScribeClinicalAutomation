import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHI, decryptPHISafe, hashSHA256 } from "@/lib/db/encryption";
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
  try {
    const dbUser = await getDbUser();
    if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
    if (!hasPermission(dbUser.role, "ai_note_gen", "execute")) {
      return NextResponse.json(apiErr("Forbidden"), { status: 403 });
    }

    const { practiceId, id: userId } = dbUser;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

    const { encounterId, transcript, noteType, noteFormat, patientContext } = parsed.data;

    // Verify encounter belongs to this practice
    const encounter = await prisma.encounter.findFirst({
      where: { id: encounterId, practiceId, deletedAt: null },
      include: { patient: true, practice: true, provider: true }
    });
    if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

    // Update status
    await prisma.encounter.update({
      where: { id: encounterId },
      data: { status: "ai_processing" },
    });

    const start = Date.now();

    // --- BUILD PATIENT CONTEXT FROM DB ---
    // 1. Calculate real age and sex from Patient profile
    let calculatedAge = patientContext?.ageYears;
    if (!calculatedAge && encounter.patient.dob) {
      const dob = new Date(encounter.patient.dob);
      calculatedAge = new Date().getFullYear() - dob.getFullYear();
    }

    // 2. Fetch recent finalized notes for this patient (historical context)
    const pastNotesRaw = await prisma.encounterNote.findMany({
      where: {
        encounter: {
          patientId: encounter.patientId,
          practiceId,
        },
        finalizedAt: { not: null },
        aiGeneratedNote: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    let historicalContextStr = "";
    if (pastNotesRaw.length > 0) {
      historicalContextStr = pastNotesRaw.map(n => {
        let text = "[Decryption Failed]";
        if (n.aiGeneratedNote) {
          try { text = decryptPHI(n.aiGeneratedNote); } catch (e) { /* ignore */ }
        }
        return `[Past Encounter on ${n.createdAt.toISOString().split('T')[0]}]\n${text}`;
      }).join("\n\n");
    }

    // 3. Assemble enriched context
    const enrichedContext = {
      ...patientContext,
      ageYears: calculatedAge,
      biologicalSex: patientContext?.biologicalSex || encounter.patient.sex || undefined,
      historicalContext: historicalContextStr || undefined,
    };

    const patientFirst = decryptPHISafe(encounter.patient.firstName) || "Unknown";
    const patientLast = decryptPHISafe(encounter.patient.lastName) || "Patient";
    const providerFirst = decryptPHISafe(encounter.provider.firstName) || "";
    const providerLast = decryptPHISafe(encounter.provider.lastName) || "";
    const sessionDurationMinutes = encounter.audioDuration ? Math.max(1, Math.round(encounter.audioDuration / 60)) : 60;

    const result = await generateClinicalNote(
      {
        encounterId,
        transcript,
        noteType: noteType as never,
        noteFormat: noteFormat as never,
        patientContext: enrichedContext,
        clinicName: encounter.practice.name,
        patientName: `${patientFirst} ${patientLast}`.trim(),
        providerName: `Dr. ${providerFirst} ${providerLast}`.trim(),
        encounterDate: encounter.encounterDate.toISOString().split("T")[0],
        sessionDurationMinutes,
      },
      encounter.specialtyType,
      noteFormat as never,
      encounterId,
    );

    // Store encrypted transcript + generated note
    const encryptedTranscript = encryptPHI(transcript);
    const encryptedNote = encryptPHI(result.note);

    // Find or create the encounter note — avoid upsert with a fake UUID fallback
    const existingNote = await prisma.encounterNote.findFirst({
      where: { encounterId, noteType: noteType as never },
      select: { id: true },
    });

    const note = existingNote
      ? await prisma.encounterNote.update({
        where: { id: existingNote.id },
        data: {
          rawTranscript: encryptedTranscript,
          aiGeneratedNote: encryptedNote,
          wordCount: result.wordCount,
          finalizedAt: null,
        },
      })
      : await prisma.encounterNote.create({
        data: {
          encounterId,
          noteType: noteType as never,
          noteFormat: noteFormat as never,
          rawTranscript: encryptedTranscript,
          aiGeneratedNote: encryptedNote,
          wordCount: result.wordCount,
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    console.error("[API-GENERATE-NOTE] Error:", msg);
    return NextResponse.json(apiErr(msg), { status: 500 });
  }
}
