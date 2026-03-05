import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { runComplianceChecks } from "@/lib/compliance/pipeda-checks";
import { validateClaim } from "@/lib/compliance/payer-validation";
import { prisma } from "@/lib/db/client";
import { decryptPHI } from "@/lib/db/encryption";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const validateSchema = z.object({
  encounterId: z.string().uuid(),
  payerName: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "compliance", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId } = dbUser;

  const checks = await runComplianceChecks(practiceId);
  const alerts = await prisma.complianceAlert.findMany({
    where: { practiceId, resolvedAt: null },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(apiOk({ checks, alerts }));
}

export async function POST(req: NextRequest) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
  if (!hasPermission(dbUser.role, "compliance", "read")) {
    return NextResponse.json(apiErr("Forbidden"), { status: 403 });
  }

  const { practiceId } = dbUser;

  const body = await req.json();
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 422 });

  const { encounterId, payerName } = parsed.data;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    include: {
      codes: true,
      notes: true,
    },
  });
  if (!encounter) return NextResponse.json(apiErr("Encounter not found"), { status: 404 });

  const latestNote = encounter.notes[encounter.notes.length - 1];
  const noteText = latestNote?.providerEditedNote
    ? decryptPHI(latestNote.providerEditedNote)
    : latestNote?.aiGeneratedNote
    ? decryptPHI(latestNote.aiGeneratedNote)
    : "";

  const result = await validateClaim({
    encounterId,
    practiceId,
    payerName,
    codes: encounter.codes,
    noteText,
  });

  return NextResponse.json(apiOk(result));
}
