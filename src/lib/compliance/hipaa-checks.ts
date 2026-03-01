import { prisma } from "@/lib/db/client";
import type { ComplianceAlertSeverity } from "@prisma/client";

interface ComplianceCheckResult {
  checkName: string;
  passed: boolean;
  severity: ComplianceAlertSeverity;
  description: string;
  remediation: string;
}

export async function runComplianceChecks(practiceId: string): Promise<ComplianceCheckResult[]> {
  const practiceExists = await prisma.practice.findUnique({ where: { id: practiceId } });
  if (!practiceExists) {
    return []; // Return empty if the practice does not exist (e.g. stale session / empty DB)
  }

  const results: ComplianceCheckResult[] = [];
  const now = new Date();

  // ─── Unsigned Notes Check ───────────────────────────────────────────────
  const unsignedNotes = await prisma.encounterNote.count({
    where: {
      encounter: { practiceId },
      finalizedAt: null,
      createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // 48h old
    },
  });

  results.push({
    checkName: "Unsigned Notes",
    passed: unsignedNotes === 0,
    severity: unsignedNotes > 0 ? "warning" : "info",
    description: unsignedNotes > 0
      ? `${unsignedNotes} encounter note(s) unsigned after 48 hours`
      : "All recent notes are signed",
    remediation: "Review and finalize all unsigned encounter notes",
  });

  // ─── Users Without MFA ──────────────────────────────────────────────────
  const noMFAUsers = await prisma.user.count({
    where: { practiceId, mfaEnabled: false, active: true },
  });

  results.push({
    checkName: "MFA Enforcement",
    passed: noMFAUsers === 0,
    severity: noMFAUsers > 0 ? "critical" : "info",
    description: noMFAUsers > 0
      ? `${noMFAUsers} active user(s) have not enabled MFA (required by PIPEDA/HIA 2025)`
      : "All active users have MFA enabled",
    remediation: "Require all users to enable TOTP MFA immediately",
  });

  // ─── Unresolved Critical Alerts ─────────────────────────────────────────
  const unresolvedCritical = await prisma.complianceAlert.count({
    where: {
      practiceId,
      severity: "critical",
      resolvedAt: null,
      createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  results.push({
    checkName: "Critical Alert Resolution",
    passed: unresolvedCritical === 0,
    severity: unresolvedCritical > 0 ? "critical" : "info",
    description: unresolvedCritical > 0
      ? `${unresolvedCritical} critical compliance alert(s) unresolved >24 hours`
      : "No overdue critical alerts",
    remediation: "Resolve all critical compliance alerts within 24 hours",
  });

  // ─── Recent Audit Log Integrity ─────────────────────────────────────────
  const recentLogs = await prisma.auditLog.count({
    where: {
      practiceId,
      timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  results.push({
    checkName: "Audit Logging Active",
    passed: recentLogs > 0,
    severity: recentLogs === 0 ? "critical" : "info",
    description: recentLogs > 0
      ? `Audit log active — ${recentLogs} events in last 24 hours`
      : "No audit log entries in last 24 hours — possible logging failure",
    remediation: "Verify audit logging service is running correctly",
  });

  // Persist any failed checks as compliance alerts
  for (const result of results) {
    if (!result.passed) {
      await prisma.complianceAlert.upsert({
        where: {
          // synthetic unique key — in real app you'd track by type
          id: `${practiceId}-${result.checkName.replace(/\s/g, "-").toLowerCase()}`,
        },
        create: {
          id: `${practiceId}-${result.checkName.replace(/\s/g, "-").toLowerCase()}`,
          practice: { connect: { id: practiceId } },
          alertType: "compliance_check",
          severity: result.severity,
          title: result.checkName,
          description: result.description,
        },
        update: {
          description: result.description,
          updatedAt: new Date(),
        },
      });
    }
  }

  return results;
}
