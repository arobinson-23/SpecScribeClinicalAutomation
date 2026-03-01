import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { encryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { parseDemographicsCsv } from "@/lib/migration/csv-parser";
import { apiOk, apiErr } from "@/types/api";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true, role: true },
  });
  if (!dbUser) return NextResponse.json(apiErr("User not found"), { status: 403 });

  // ── RBAC: admin / superadmin only ──────────────────────────────────────────
  if (dbUser.role !== "admin" && dbUser.role !== "superadmin") {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId, id: adminId } = dbUser;

  // ── Parse multipart CSV ─────────────────────────────────────────────────────
  let csvText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(apiErr("No file uploaded"), { status: 422 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(apiErr("File must be a .csv"), { status: 422 });
    }
    csvText = await file.text();
  } catch {
    return NextResponse.json(apiErr("Failed to read uploaded file"), { status: 400 });
  }

  // ── Parse CSV ───────────────────────────────────────────────────────────────
  const { rows, errors: parseErrors } = parseDemographicsCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json(
      apiErr(`No valid rows found. Parse errors: ${parseErrors.map((e) => e.message).join("; ")}`),
      { status: 422 }
    );
  }

  // ── Import rows ─────────────────────────────────────────────────────────────
  const batchId = uuidv4();
  const importedAt = new Date().toISOString();

  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      // Check for duplicate (PHN is stored as mrn, practice-scoped unique)
      const existing = await prisma.patient.findUnique({
        where: { practiceId_mrn: { practiceId, mrn: row.phn } },
        select: { id: true },
      });

      if (existing) {
        duplicateCount++;
        await prisma.migrationLog.create({
          data: {
            practiceId,
            adminId,
            action: "PATIENT_IMPORT",
            recordId: existing.id,
            recordType: "patient",
            status: "duplicate",
            sourceFile: "Demographics.csv",
            detail: { batchId, pseudoId: row.pseudoId },
          },
        });
        continue;
      }

      // Encrypt all PHI fields before write
      const patient = await prisma.patient.create({
        data: {
          practiceId,
          mrn: row.phn,                          // PHN stored as MRN (not encrypted — used as lookup key)
          firstName: encryptPHI(row.firstName),
          lastName: encryptPHI(row.lastName),
          dob: encryptPHI(row.dob),
          sex: row.sex,
          phone: row.phone ? encryptPHI(row.phone) : null,
          email: row.email ? encryptPHI(row.email) : null,
          address: row.address ? encryptPHI(JSON.stringify(row.address)) : null,
          metadata: {
            legacyId: row.pseudoId,
            importedAt,
            importBatchId: batchId,
          },
        },
        select: { id: true },
      });

      // HIA migration log
      await prisma.migrationLog.create({
        data: {
          practiceId,
          adminId,
          action: "PATIENT_IMPORT",
          recordId: patient.id,
          recordType: "patient",
          status: "success",
          sourceFile: "Demographics.csv",
          detail: { batchId, pseudoId: row.pseudoId },
        },
      });

      // General HIPAA audit log — field names only, never values
      await writeAuditLog({
        practiceId,
        userId: adminId,
        userRole: dbUser.role,
        action: "CREATE",
        resource: "patient",
        resourceId: patient.id,
        outcome: "success",
        fieldsChanged: ["mrn", "firstName", "lastName", "dob", "sex", "phone", "email", "address", "metadata"],
        metadata: { batchId, source: "migration_import" },
      });

      successCount++;
    } catch (err) {
      errorCount++;
      await prisma.migrationLog.create({
        data: {
          practiceId,
          adminId,
          action: "PATIENT_IMPORT",
          recordType: "patient",
          status: "error",
          sourceFile: "Demographics.csv",
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
      total: rows.length,
      imported: successCount,
      duplicates: duplicateCount,
      errors: errorCount,
      parseErrors: parseErrors.length,
    }),
    { status: 201 }
  );
}
