import { prisma } from "./client";
import { hashSHA256 } from "./encryption";
import type { AuditAction } from "@prisma/client";

interface AuditParams {
  practiceId: string;
  userId?: string;
  userRole?: string;
  sessionId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome?: "success" | "failure" | "denied";
  errorCode?: string;
  fieldsAccessed?: string[];
  fieldsChanged?: string[];
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  const {
    practiceId,
    userId,
    userRole,
    sessionId,
    action,
    resource,
    resourceId,
    ipAddress,
    userAgent,
    outcome = "success",
    errorCode,
    fieldsAccessed,
    fieldsChanged,
    metadata = {},
  } = params;

  // Build a hash of this entry for tamper detection
  const entryData = JSON.stringify({
    practiceId,
    userId,
    action,
    resource,
    resourceId,
    outcome,
    timestamp: new Date().toISOString(),
  });
  const entryHash = hashSHA256(entryData);

  try {
    await prisma.auditLog.create({
      data: {
        practiceId,
        userId,
        userRole,
        sessionId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        outcome,
        errorCode,
        fieldsAccessed: fieldsAccessed ?? undefined,
        fieldsChanged: fieldsChanged ?? undefined,
        metadata,
        entryHash,
      },
    });
  } catch (error) {
    // Audit logging must never crash the application
    console.error("[AuditLog] Failed to write audit log:", error);
  }
}
