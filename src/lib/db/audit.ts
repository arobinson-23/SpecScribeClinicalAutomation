import { prisma } from "./client";
import { hashSHA256 } from "./encryption";
import { logger } from "@/lib/utils/logger";
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
        metadata: metadata as object,
        entryHash,
      },
    });
  } catch (error) {
    // Audit logging must never crash the application, but failures must be
    // visible for alerting. Create a Datadog/CloudWatch log alert on:
    //   alertCode = "AUDIT_LOG_FAILURE"
    // to page on-call when this fires in production.
    logger.error("AUDIT_LOG_FAILURE", {
      alertCode: "AUDIT_LOG_FAILURE",
      practiceId,
      userId,
      action,
      resource,
      resourceId,
      outcome,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
