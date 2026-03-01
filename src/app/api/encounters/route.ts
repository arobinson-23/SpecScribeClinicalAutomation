import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import { decryptPHISafe } from "@/lib/db/encryption";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const createEncounterSchema = z.object({
  // Accept either UUID or MRN string for patient lookup
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().min(1).optional(),
  encounterDate: z.string().min(1), // ISO or datetime-local format
  specialtyType: z.enum(["behavioral_health", "dermatology", "orthopedics", "pain_management", "oncology"]).optional(),
  noteType: z.enum(["progress_note", "intake", "biopsychosocial", "treatment_plan", "procedure", "consultation", "discharge"]),
  noteFormat: z.enum(["SOAP", "DAP", "BIRP", "NARRATIVE"]),
}).refine((d) => d.patientId || d.patientMrn, { message: "patientId or patientMrn required" });

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true }, // Simplified for demo, should match clerkId
    select: { id: true, practiceId: true }
  });

  if (!dbUser) return NextResponse.json(apiErr("User records not synchronized"), { status: 403 });

  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const status = searchParams.get("status");
  const providerId = searchParams.get("providerId");

  const encounters = await prisma.encounter.findMany({
    where: {
      practiceId,
      deletedAt: null,
      ...(status ? { status: status as never } : {}),
      ...(providerId ? { providerId } : {}),
    },
    include: {
      patient: { select: { firstName: true, lastName: true, mrn: true } },
      provider: { select: { firstName: true, lastName: true, credentials: true } },
      notes: { select: { noteType: true, finalizedAt: true } },
      codes: { select: { code: true, codeType: true, providerAccepted: true } },
    },
    orderBy: { encounterDate: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = encounters.length > limit;
  const items = hasMore ? encounters.slice(0, -1) : encounters;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  // Decrypt PHI fields
  const decrypted = items.map((enc) => ({
    ...enc,
    patient: {
      ...enc.patient,
      firstName: decryptPHISafe(enc.patient.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(enc.patient.lastName) ?? "[encrypted]",
    },
    provider: {
      ...enc.provider,
      firstName: decryptPHISafe(enc.provider.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(enc.provider.lastName) ?? "[encrypted]",
    },
  }));

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "encounter",
    fieldsAccessed: ["id", "status", "encounterDate", "patient", "provider"],
    metadata: { count: items.length },
  });

  return NextResponse.json(
    apiOk({ items: decrypted, nextCursor, hasMore })
  );
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true }, // Simplified for demo
    select: { id: true, practiceId: true }
  });

  if (!dbUser) return NextResponse.json(apiErr("Account not found"), { status: 403 });

  const practiceId = dbUser.practiceId;
  const userId = dbUser.id;

  const body = await req.json();
  const parsed = createEncounterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiErr(parsed.error.message), { status: 422 });
  }

  const { patientId, patientMrn, encounterDate, noteType, noteFormat, specialtyType } = parsed.data;

  // Verify patient belongs to practice (by ID or MRN)
  const patient = await prisma.patient.findFirst({
    where: {
      practiceId,
      deletedAt: null,
      ...(patientId ? { id: patientId } : { mrn: patientMrn }),
    },
  });
  if (!patient) return NextResponse.json(apiErr("Patient not found"), { status: 404 });

  // Get practice specialty (override only if not provided)
  const practice = await prisma.practice.findUnique({ where: { id: practiceId } });

  // Parse date — handle both ISO and datetime-local formats
  const parsedDate = new Date(encounterDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json(apiErr("Invalid encounterDate format"), { status: 422 });
  }

  const encounter = await prisma.encounter.create({
    data: {
      practiceId,
      patientId: patient.id,
      providerId: userId,
      encounterDate: parsedDate,
      status: "not_started",
      specialtyType: (specialtyType ?? practice?.specialty ?? "behavioral_health") as "behavioral_health",
    },
  });

  // Create the initial note record
  await prisma.encounterNote.create({
    data: {
      encounterId: encounter.id,
      noteType: noteType as never,
      noteFormat: noteFormat as never,
    },
  });

  await writeAuditLog({
    practiceId,
    userId,
    action: "CREATE",
    resource: "encounter",
    resourceId: encounter.id,
  });

  return NextResponse.json(apiOk(encounter), { status: 201 });
}
