import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";

export const runtime = "nodejs";

export interface SamplePatientRecord {
  id: string;
  mrn: string;            // PHN
  firstName: string;
  lastName: string;
  dob: string;
  sex: string | null;
  legacyId: string;
  importedAt: string;
  importBatchId: string;
}

export async function GET(req: NextRequest) {
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

  // Optional batchId filter
  const batchId = new URL(req.url).searchParams.get("batchId");

  // ── Fetch 10 most recently imported patients ────────────────────────────────
  // We identify imported patients by the presence of metadata.importedAt
  const rawPatients = await prisma.patient.findMany({
    where: {
      practiceId,
      deletedAt: null,
      // Filter for patients that have migration metadata
      metadata: { path: ["importedAt"], not: "" },
      ...(batchId
        ? { metadata: { path: ["importBatchId"], equals: batchId } }
        : {}),
    },
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      dob: true,
      sex: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  await writeAuditLog({
    practiceId,
    userId: adminId,
    userRole: dbUser.role,
    action: "READ",
    resource: "patient",
    outcome: "success",
    fieldsAccessed: ["id", "mrn", "firstName", "lastName", "dob", "sex", "metadata"],
    metadata: { source: "migration_validation_sample", count: rawPatients.length },
  });

  // ── Decrypt PHI fields ──────────────────────────────────────────────────────
  const records: SamplePatientRecord[] = rawPatients.map((p) => {
    const meta = p.metadata as Record<string, string>;
    return {
      id: p.id,
      mrn: p.mrn,
      firstName: decryptPHISafe(p.firstName) ?? "[encrypted]",
      lastName: decryptPHISafe(p.lastName) ?? "[encrypted]",
      dob: decryptPHISafe(p.dob) ?? "[encrypted]",
      sex: p.sex,
      legacyId: meta.legacyId ?? "",
      importedAt: meta.importedAt ?? "",
      importBatchId: meta.importBatchId ?? "",
    };
  });

  return NextResponse.json(apiOk({ records }));
}
