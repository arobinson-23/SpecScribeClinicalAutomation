import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import {
  extractPdfsFromZip,
  stripPdfMetadata,
  matchPatientByName,
  uploadPdfToS3,
} from "@/lib/migration/pdf-processor";
import { apiOk, apiErr } from "@/types/api";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// ZIP files can be large — allow up to 200 MB
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true, role: true },
  });
  if (!dbUser) return NextResponse.json(apiErr("User not found"), { status: 403 });

  if (dbUser.role !== "admin" && dbUser.role !== "superadmin") {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: adminId } = dbUser;

  // ── Parse multipart ZIP ─────────────────────────────────────────────────────
  let zipBuffer: ArrayBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(apiErr("No file uploaded"), { status: 422 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(apiErr("File must be a .zip"), { status: 422 });
    }
    zipBuffer = await file.arrayBuffer();
  } catch {
    return NextResponse.json(apiErr("Failed to read uploaded file"), { status: 400 });
  }

  // ── Extract PDFs from ZIP ───────────────────────────────────────────────────
  let pdfEntries;
  try {
    pdfEntries = await extractPdfsFromZip(zipBuffer);
  } catch {
    return NextResponse.json(apiErr("Failed to extract ZIP archive"), { status: 400 });
  }

  if (pdfEntries.length === 0) {
    return NextResponse.json(apiErr("No valid PDF files found in ZIP"), { status: 422 });
  }

  // ── Load all practice patients for name matching (decrypt in memory) ────────
  // This is an admin-only batch operation; we decrypt names for matching only —
  // never persisted in logs or returned to client.
  const rawPatients = await prisma.patient.findMany({
    where: { practiceId, deletedAt: null, active: true },
    select: { id: true, firstName: true, lastName: true },
  });

  const decryptedPatients = rawPatients.map((p) => ({
    id: p.id,
    firstName: decryptPHISafe(p.firstName) ?? "",
    lastName: decryptPHISafe(p.lastName) ?? "",
  }));

  await writeAuditLog({
    practiceId,
    userId: adminId,
    userRole: dbUser.role,
    action: "READ",
    resource: "patient",
    outcome: "success",
    fieldsAccessed: ["id", "firstName", "lastName"],
    metadata: { source: "migration_note_name_match", count: rawPatients.length },
  });

  // ── Process each PDF ────────────────────────────────────────────────────────
  const batchId = uuidv4();
  let successCount = 0;
  let noMatchCount = 0;
  let errorCount = 0;

  for (const entry of pdfEntries) {
    const patientId = matchPatientByName(
      entry.inferredFirstName,
      entry.inferredLastName,
      decryptedPatients
    );

    if (!patientId) {
      noMatchCount++;
      await prisma.migrationLog.create({
        data: {
          practiceId,
          adminId,
          action: "NOTE_IMPORT",
          recordType: "clinical_note",
          status: "no_match",
          sourceFile: entry.filename,     // filename contains no PHI — just first_last
          detail: { batchId },
        },
      });
      continue;
    }

    try {
      // Strip all identifying metadata from the PDF
      const strippedBytes = await stripPdfMetadata(entry.pdfBytes);

      // Upload stripped PDF to private S3 bucket with server-side AES-256
      const s3Key = await uploadPdfToS3(strippedBytes, practiceId, patientId);

      // HIA migration log
      await prisma.migrationLog.create({
        data: {
          practiceId,
          adminId,
          action: "NOTE_IMPORT",
          recordId: s3Key,
          recordType: "clinical_note",
          status: "success",
          sourceFile: entry.filename,
          detail: { batchId, patientId },
        },
      });

      await writeAuditLog({
        practiceId,
        userId: adminId,
        userRole: dbUser.role,
        action: "CREATE",
        resource: "migration_note",
        resourceId: s3Key,
        outcome: "success",
        fieldsChanged: ["s3Key"],
        metadata: { batchId, patientId, source: "migration_import" },
      });

      successCount++;
    } catch (err) {
      errorCount++;
      await prisma.migrationLog.create({
        data: {
          practiceId,
          adminId,
          action: "NOTE_IMPORT",
          recordType: "clinical_note",
          status: "error",
          sourceFile: entry.filename,
          detail: {
            batchId,
            error: err instanceof Error ? err.message : "Unknown error",
          },
        },
      });
    }
  }

  return NextResponse.json(
    apiOk({
      batchId,
      total: pdfEntries.length,
      uploaded: successCount,
      noMatch: noMatchCount,
      errors: errorCount,
    }),
    { status: 201 }
  );
}
