"use server";

/**
 * Clinical Authorization Engine — Server Actions
 *
 * All PHI processing happens here on the server. No PHI is written to
 * localStorage or client-side state stores. HIA custodial control is
 * maintained throughout the wizard flow.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDbUser } from "@/lib/auth/get-db-user";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe, encryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { hasPermission } from "@/lib/auth/rbac";
import {
  generateStepTherapyAnalysis,
  generateAlbertaJustification,
  stripCanadianIdentifiers,
} from "@/lib/ai/anthropic";
import {
  ALBERTA_PAYER_CONFIG,
  type ActionResult,
  type AlbertaPayerPreset,
  type ClinicalJustification,
  type EncounterContext,
  type EncounterForAuth,
  type PayerSpecificData,
  type StepTherapyEntry,
  type StepTherapyEntryDb,
} from "@/types/prior-auth";

// ── Encounter list ────────────────────────────────────────────────────────────

/**
 * Fetch encounters eligible for a new prior auth.
 * Called from the RSC page — not a client-triggered action.
 */
export async function getEncountersForAuthAction(): Promise<EncounterForAuth[]> {
  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");
  if (!hasPermission(dbUser.role, "prior_auth", "create")) redirect("/403");

  const { practiceId } = dbUser;

  const encounters = await prisma.encounter.findMany({
    where: { practiceId, deletedAt: null },
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, phn: true },
      },
      provider: {
        select: { firstName: true, lastName: true },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { finalizedAt: true, providerEditedNote: true },
      },
    },
    orderBy: { encounterDate: "desc" },
    take: 100,
  });

  return encounters.map((enc) => ({
    id: enc.id,
    patientId: enc.patient.id,
    patientName: `${decryptPHISafe(enc.patient.firstName) ?? ""} ${decryptPHISafe(enc.patient.lastName) ?? ""}`.trim() || "Unknown Patient",
    patientPhn: enc.patient.phn,
    providerName: `${decryptPHISafe(enc.provider.firstName) ?? ""} ${decryptPHISafe(enc.provider.lastName) ?? ""}`.trim(),
    encounterDate: enc.encounterDate.toISOString(),
    status: enc.status,
    hasNote: enc.notes.length > 0 && !!enc.notes[0]?.providerEditedNote,
  }));
}

// ── Patient / encounter context ───────────────────────────────────────────────

/**
 * Fetch and decrypt patient demographics + provider info for the wizard header.
 * Audit-logged as a PHI READ event.
 */
export async function getEncounterContextAction(
  encounterId: string,
): Promise<ActionResult<EncounterContext>> {
  const dbUser = await getDbUser();
  if (!dbUser) return { success: false, error: "Unauthorized" };
  if (!hasPermission(dbUser.role, "prior_auth", "create"))
    return { success: false, error: "Forbidden" };

  const { practiceId, id: userId, role } = dbUser;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dob: true,
          sex: true,
          phn: true,
        },
      },
      provider: {
        select: {
          firstName: true,
          lastName: true,
          credentials: true,
          provincialRegistrationNumber: true,
        },
      },
    },
  });

  if (!encounter) return { success: false, error: "Encounter not found" };

  const { patient, provider } = encounter;

  // Decrypt patient PHI
  const firstName = decryptPHISafe(patient.firstName) ?? "";
  const lastName = decryptPHISafe(patient.lastName) ?? "";
  const dob = decryptPHISafe(patient.dob);
  const phn = patient.phn;

  // Audit log — PHI fields accessed
  await writeAuditLog({
    practiceId,
    userId,
    userRole: role,
    action: "READ",
    resource: "patient",
    resourceId: patient.id,
    outcome: "success",
    fieldsAccessed: ["firstName", "lastName", "dob", "phn"],
    metadata: { context: "prior_auth_wizard", encounterId },
  });

  return {
    success: true,
    data: {
      patientName: `${firstName} ${lastName}`.trim() || "Unknown Patient",
      dob,
      phn,
      sex: patient.sex,
      providerName: `${decryptPHISafe(provider.firstName) ?? ""} ${decryptPHISafe(provider.lastName) ?? ""}`.trim(),
      providerCredentials: provider.credentials,
      providerRegistrationNumber: provider.provincialRegistrationNumber,
    },
  };
}

// ── Step therapy analysis ─────────────────────────────────────────────────────

/**
 * Scan the encounter's clinical notes with Claude and extract prior treatment
 * failures for the FAILED step therapy table.
 */
export async function generateStepTherapyAction(
  encounterId: string,
): Promise<ActionResult<StepTherapyEntry[]>> {
  const dbUser = await getDbUser();
  if (!dbUser) return { success: false, error: "Unauthorized" };
  if (!hasPermission(dbUser.role, "prior_auth", "create"))
    return { success: false, error: "Forbidden" };

  const { practiceId, id: userId, role } = dbUser;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          providerEditedNote: true,
          aiGeneratedNote: true,
        },
      },
    },
  });

  if (!encounter) return { success: false, error: "Encounter not found" };
  if (!encounter.notes.length)
    return { success: false, error: "No clinical notes found for this encounter" };

  // Prefer provider-edited notes; fall back to AI-generated
  const noteTexts = encounter.notes
    .map((n) => decryptPHISafe(n.providerEditedNote) ?? decryptPHISafe(n.aiGeneratedNote))
    .filter((t): t is string => t !== null);

  if (!noteTexts.length)
    return { success: false, error: "No readable clinical note content found" };

  // Strip PHIs before sending to AI (PHN patterns, 9-digit numbers)
  const redacted = noteTexts.map(stripCanadianIdentifiers);

  await writeAuditLog({
    practiceId,
    userId,
    userRole: role,
    action: "AI_INVOCATION",
    resource: "encounter_note",
    resourceId: encounterId,
    outcome: "success",
    fieldsAccessed: ["providerEditedNote", "aiGeneratedNote"],
    metadata: { interactionType: "step_therapy_analysis", noteCount: redacted.length, complianceStandard: "HIA (Alberta) / PIPEDA" },
  });

  const raw = await generateStepTherapyAnalysis({ notes: redacted, encounterId });

  const entries: StepTherapyEntry[] = raw.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    isAiGenerated: true,
  }));

  return { success: true, data: entries };
}

// ── Clinical justification ────────────────────────────────────────────────────

const justificationInputSchema = z.object({
  encounterId: z.string().uuid(),
  payerPreset: z.enum(["abc", "sunlife", "ahs_special_auth"]),
  payerData: z.object({
    ahcipPhysicianId: z.string().optional(),
    specialAuthFormNumber: z.string().optional(),
    groupPlanNumber: z.string().optional(),
    memberCertificateId: z.string().optional(),
    ahsProviderNumber: z.string().optional(),
    aishStatus: z.boolean().optional(),
  }),
  procedureCodes: z.array(z.string().min(1)).min(1, "At least one procedure code required"),
  diagnosisCodes: z.array(z.string().min(1)).min(1, "At least one diagnosis code required"),
  stepTherapy: z.array(
    z.object({
      drugOrTherapy: z.string(),
      duration: z.string(),
      reasonForFailure: z.string(),
    }),
  ),
});

export async function generateJustificationAction(
  params: z.infer<typeof justificationInputSchema>,
): Promise<ActionResult<ClinicalJustification>> {
  const dbUser = await getDbUser();
  if (!dbUser) return { success: false, error: "Unauthorized" };
  if (!hasPermission(dbUser.role, "prior_auth", "create"))
    return { success: false, error: "Forbidden" };

  const parsed = justificationInputSchema.safeParse(params);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors.map((e) => e.message).join("; ") };

  const { practiceId, id: userId, role } = dbUser;
  const data = parsed.data;

  const encounter = await prisma.encounter.findFirst({
    where: { id: data.encounterId, practiceId, deletedAt: null },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { providerEditedNote: true, aiGeneratedNote: true },
      },
    },
  });

  if (!encounter) return { success: false, error: "Encounter not found" };

  const note = encounter.notes[0];
  if (!note) return { success: false, error: "No clinical notes found" };

  const noteText = decryptPHISafe(note.providerEditedNote) ?? decryptPHISafe(note.aiGeneratedNote);
  if (!noteText) return { success: false, error: "No readable clinical note content" };

  const payerConfig = ALBERTA_PAYER_CONFIG[data.payerPreset];
  const redactedNote = stripCanadianIdentifiers(noteText);

  await writeAuditLog({
    practiceId,
    userId,
    userRole: role,
    action: "AI_INVOCATION",
    resource: "encounter_note",
    resourceId: data.encounterId,
    outcome: "success",
    fieldsAccessed: ["providerEditedNote", "aiGeneratedNote"],
    metadata: {
      interactionType: "alberta_prior_auth_justification",
      payerPreset: data.payerPreset,
      complianceStandard: "HIA (Alberta) / PIPEDA",
    },
  });

  const result = await generateAlbertaJustification({
    payerName: payerConfig.name,
    payerPreset: data.payerPreset,
    procedureCodes: data.procedureCodes,
    diagnosisCodes: data.diagnosisCodes,
    clinicalNote: redactedNote,
    stepTherapy: data.stepTherapy,
    payerData: data.payerData as PayerSpecificData,
    encounterId: data.encounterId,
  });

  return { success: true, data: result };
}

// ── Create & sign ─────────────────────────────────────────────────────────────

const createSignSchema = z.object({
  encounterId: z.string().uuid(),
  payerPreset: z.enum(["abc", "sunlife", "ahs_special_auth"]),
  payerData: z.object({
    ahcipPhysicianId: z.string().optional(),
    specialAuthFormNumber: z.string().optional(),
    groupPlanNumber: z.string().optional(),
    memberCertificateId: z.string().optional(),
    ahsProviderNumber: z.string().optional(),
    aishStatus: z.boolean().optional(),
  }),
  procedureCodes: z.array(z.string().min(1)).min(1),
  diagnosisCodes: z.array(z.string().min(1)).min(1),
  stepTherapy: z.array(
    z.object({
      drugOrTherapy: z.string(),
      startDate: z.string().nullable(),
      duration: z.string(),
      reasonForFailure: z.string(),
      supportingEvidence: z.string().nullable(),
      dsmCode: z.string().nullable(),
    }),
  ),
  clinicalSummary: z.string().min(10, "Clinical summary is required"),
  medicalNecessityStatement: z.string().min(10, "Medical necessity statement is required"),
  dsmCodes: z.array(z.string()),
  missingDocumentation: z.array(z.string()),
});

/**
 * Atomically create and sign a prior auth request.
 * PHI is encrypted before DB write. Physician signature is captured server-side.
 * This is the ONLY operation that writes to the DB during the wizard.
 */
export async function createAndSignPriorAuthAction(
  params: z.infer<typeof createSignSchema>,
): Promise<ActionResult<{ priorAuthId: string }>> {
  const dbUser = await getDbUser();
  if (!dbUser) return { success: false, error: "Unauthorized" };
  if (!hasPermission(dbUser.role, "prior_auth", "create"))
    return { success: false, error: "Forbidden: insufficient permissions" };

  const parsed = createSignSchema.safeParse(params);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors.map((e) => e.message).join("; ") };

  const { practiceId, id: userId, role } = dbUser;
  const data = parsed.data;

  // Verify encounter belongs to this practice
  const encounter = await prisma.encounter.findFirst({
    where: { id: data.encounterId, practiceId, deletedAt: null },
    select: { id: true },
  });
  if (!encounter) return { success: false, error: "Encounter not found" };

  const payerConfig = ALBERTA_PAYER_CONFIG[data.payerPreset];

  // Encrypt PHI clinical text before DB write
  const encryptedSummary = encryptPHI(data.clinicalSummary);
  const encryptedNecessity = encryptPHI(data.medicalNecessityStatement);

  // Strip client-only fields from step therapy before storing
  const stepTherapyDb: StepTherapyEntryDb[] = data.stepTherapy.map(
    ({ ...rest }) => rest,
  );

  const priorAuth = await prisma.priorAuthRequest.create({
    data: {
      practiceId,
      encounterId: data.encounterId,
      payerId: payerConfig.id,
      payerName: payerConfig.name,
      payerPreset: data.payerPreset,
      procedureCodes: data.procedureCodes,
      diagnosisCodes: data.diagnosisCodes,
      status: "pending_submission",
      clinicalSummary: encryptedSummary,
      medicalNecessityStatement: encryptedNecessity,
      missingDocumentation: data.missingDocumentation,
      stepTherapyJson: stepTherapyDb,
      dsmCodes: data.dsmCodes,
      physicianSignedAt: new Date(),
      physicianSignedById: userId,
      aiDisclosureAcknowledged: true,
    },
    select: { id: true },
  });

  await writeAuditLog({
    practiceId,
    userId,
    userRole: role,
    action: "CREATE",
    resource: "prior_auth_request",
    resourceId: priorAuth.id,
    outcome: "success",
    fieldsChanged: [
      "clinicalSummary",
      "medicalNecessityStatement",
      "stepTherapyJson",
      "dsmCodes",
      "physicianSignedAt",
      "aiDisclosureAcknowledged",
    ],
    metadata: {
      payerPreset: data.payerPreset,
      payerName: payerConfig.name,
      procedureCodeCount: data.procedureCodes.length,
      complianceStandard: "HIA (Alberta) / PIPEDA / CPSA 2026",
      aiDisclosureAcknowledged: true,
    },
  });

  return { success: true, data: { priorAuthId: priorAuth.id } };
}
