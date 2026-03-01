"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import { z } from "zod";

const signOffSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1).max(10),
});

export async function signOffValidation(
  recordIds: string[]
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, practiceId: true, role: true },
  });
  if (!dbUser) return { success: false, error: "User not found" };

  if (dbUser.role !== "admin" && dbUser.role !== "superadmin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = signOffSchema.safeParse({ recordIds });
  if (!parsed.success) return { success: false, error: "Invalid record IDs" };

  const { practiceId, id: adminId } = dbUser;

  // Verify all record IDs belong to this practice before signing off
  const patients = await prisma.patient.findMany({
    where: { id: { in: parsed.data.recordIds }, practiceId, deletedAt: null },
    select: { id: true },
  });

  if (patients.length === 0) {
    return { success: false, error: "No matching records found for this practice" };
  }

  // Create one sign-off log entry per verified patient
  await prisma.migrationLog.createMany({
    data: patients.map((p) => ({
      practiceId,
      adminId,
      action: "VALIDATION_SIGN_OFF",
      recordId: p.id,
      recordType: "patient",
      status: "success",
      detail: { signedOffAt: new Date().toISOString() },
    })),
  });

  await writeAuditLog({
    practiceId,
    userId: adminId,
    userRole: dbUser.role,
    action: "CREATE",
    resource: "migration_validation",
    outcome: "success",
    metadata: {
      source: "validation_sign_off",
      recordCount: patients.length,
    },
  });

  return { success: true, count: patients.length };
}
