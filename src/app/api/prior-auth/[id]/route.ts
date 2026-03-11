import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { encryptPHI, decryptPHI } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const PriorAuthStatusValues = [
    "not_required", "pending_submission", "submitted",
    "under_review", "approved", "denied", "appealed", "expired",
] as const;

const UpdatePriorAuthSchema = z.object({
    clinicalSummary: z.string().optional(),
    medicalNecessityStatement: z.string().optional(),
    status: z.enum(PriorAuthStatusValues).optional(),
    authNumber: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
    const dbUser = await getDbUser();
    if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
    if (!hasPermission(dbUser.role, "prior_auth", "read")) {
        return NextResponse.json(apiErr("Forbidden"), { status: 403 });
    }

    const { id } = await params;
    const { practiceId, id: userId } = dbUser;

    const pa = await prisma.priorAuthRequest.findFirst({
        where: { id, practiceId },
        include: {
            encounter: {
                include: { patient: true }
            }
        }
    });

    if (!pa) return NextResponse.json(apiErr("Prior authorization not found"), { status: 404 });

    const result = {
        ...pa,
        clinicalSummary: pa.clinicalSummary ? decryptPHI(pa.clinicalSummary) : null,
        medicalNecessityStatement: pa.medicalNecessityStatement ? decryptPHI(pa.medicalNecessityStatement) : null,
    };

    await writeAuditLog({
        practiceId,
        userId,
        action: "READ",
        resource: "prior_auth_request",
        resourceId: id,
        fieldsAccessed: ["clinicalSummary", "medicalNecessityStatement"],
    });

    return NextResponse.json(apiOk(result));
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const dbUser = await getDbUser();
    if (!dbUser) return NextResponse.json(apiErr("Unauthorized"), { status: 401 });
    if (!hasPermission(dbUser.role, "prior_auth", "update")) {
        return NextResponse.json(apiErr("Forbidden"), { status: 403 });
    }

    const { id } = await params;
    const { practiceId, id: userId } = dbUser;

    const body = await req.json().catch(() => null);
    const parsed = UpdatePriorAuthSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(apiErr(parsed.error.message), { status: 400 });

    const pa = await prisma.priorAuthRequest.findFirst({
        where: { id, practiceId },
    });

    if (!pa) return NextResponse.json(apiErr("Prior authorization not found"), { status: 404 });

    const updateData: Prisma.PriorAuthRequestUpdateInput = {};
    if (parsed.data.clinicalSummary !== undefined) {
        updateData.clinicalSummary = encryptPHI(parsed.data.clinicalSummary);
    }
    if (parsed.data.medicalNecessityStatement !== undefined) {
        updateData.medicalNecessityStatement = encryptPHI(parsed.data.medicalNecessityStatement);
    }
    if (parsed.data.status !== undefined) {
        updateData.status = parsed.data.status;
    }
    if (parsed.data.authNumber !== undefined) {
        updateData.authNumber = parsed.data.authNumber;
    }

    const updated = await prisma.priorAuthRequest.update({
        where: { id },
        data: updateData,
    });

    await writeAuditLog({
        practiceId,
        userId,
        action: "UPDATE",
        resource: "prior_auth_request",
        resourceId: id,
        metadata: { fieldsChanged: Object.keys(updateData) },
    });

    return NextResponse.json(apiOk(updated));
}
