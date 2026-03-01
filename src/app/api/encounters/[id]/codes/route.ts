import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import { z } from "zod";

const AcceptCodeSchema = z.object({
  code: z.string().min(1),
  accepted: z.boolean(),
  modifier: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/encounters/[id]/codes — list suggested codes for an encounter
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: encounterId } = await params;
  const practiceId = (session as unknown as { practiceId: string }).practiceId;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    select: { id: true },
  });
  if (!encounter) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const codes = await prisma.encounterCode.findMany({
    where: { encounterId },
    orderBy: [{ codeType: "asc" }, { aiConfidence: "desc" }],
    select: {
      id: true,
      codeType: true,
      code: true,
      description: true,
      modifier: true,
      aiConfidence: true,
      aiRationale: true,
      providerAccepted: true,
      rejectionRiskScore: true,
    },
  });

  return NextResponse.json({ data: codes });
}

// PATCH /api/encounters/[id]/codes — accept or reject a suggested code
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: encounterId } = await params;
  const practiceId = (session as unknown as { practiceId: string }).practiceId;
  const userId = (session as unknown as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = AcceptCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify encounter belongs to this practice
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, practiceId, deletedAt: null },
    select: { id: true },
  });
  if (!encounter) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Find the specific code record
  const existingCode = await prisma.encounterCode.findFirst({
    where: { encounterId, code: parsed.data.code },
  });
  if (!existingCode) return NextResponse.json({ error: "CODE_NOT_FOUND" }, { status: 404 });

  const updatedCode = await prisma.encounterCode.update({
    where: { id: existingCode.id },
    data: {
      providerAccepted: parsed.data.accepted,
      modifier: parsed.data.modifier ?? existingCode.modifier,
      acceptedAt: parsed.data.accepted ? new Date() : null,
      acceptedBy: parsed.data.accepted ? userId : null,
    },
    select: {
      id: true,
      code: true,
      providerAccepted: true,
      modifier: true,
    },
  });

  await writeAuditLog({
    userId,
    practiceId,
    action: "UPDATE",
    resource: "encounter_code",
    resourceId: existingCode.id,
    metadata: {
      fieldsChanged: ["providerAccepted"],
      outcome: "success",
    },
  });

  return NextResponse.json({ data: updatedCode });
}
