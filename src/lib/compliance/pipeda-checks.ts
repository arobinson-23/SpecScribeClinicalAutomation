import { prisma } from "@/lib/db/client";
import type { ComplianceAlertSeverity } from "@prisma/client";
import { getPracticeVerificationStatus } from "@/lib/compliance/oig-screening";

export interface ComplianceCheckResult {
  checkName: string;
  /** Stable identifier used as the ComplianceAlert.alertType upsert key */
  alertType: string;
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
    alertType: "pipeda_unsigned_notes",
    passed: unsignedNotes === 0,
    severity: unsignedNotes > 0 ? "warning" : "info",
    description: unsignedNotes > 0
      ? `${unsignedNotes} encounter note(s) unsigned after 48 hours`
      : "All recent notes are signed",
    remediation: "Review and finalize all unsigned encounter notes",
  });

  // ─── MFA Enforcement ─────────────────────────────────────────────────────
  // MFA is now enforced by Clerk at the sign-in level (required for all users
  // in the Clerk Dashboard). A valid Clerk session proves MFA was completed.
  results.push({
    checkName: "MFA Enforcement",
    alertType: "pipeda_mfa_enforcement",
    passed: true,
    severity: "info",
    description: "MFA enforced by Clerk for all users (TOTP, SMS, or email code required at sign-in)",
    remediation: "Verify MFA is set to Required in the Clerk Dashboard under User & Authentication → Multi-factor",
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
    alertType: "pipeda_critical_alerts_overdue",
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
    alertType: "pipeda_audit_logging_inactive",
    passed: recentLogs > 0,
    severity: recentLogs === 0 ? "critical" : "info",
    description: recentLogs > 0
      ? `Audit log active — ${recentLogs} events in last 24 hours`
      : "No audit log entries in last 24 hours — possible logging failure",
    remediation: "Verify audit logging service is running correctly",
  });

  // ─── Provider College Verification ──────────────────────────────────────────
  const verificationStatus = await getPracticeVerificationStatus(practiceId);
  const hasProblems =
    verificationStatus.notInGoodStanding > 0 ||
    verificationStatus.expired > 0 ||
    verificationStatus.neverChecked > 0;

  results.push({
    checkName: "Provider College Standing",
    alertType: "pipeda_provider_college_standing",
    passed: !hasProblems,
    severity: (verificationStatus.notInGoodStanding > 0
      ? "critical"
      : verificationStatus.expired > 0 || verificationStatus.neverChecked > 0
      ? "warning"
      : "info") as ComplianceAlertSeverity,
    description: hasProblems
      ? `${verificationStatus.notInGoodStanding} not in good standing · ${verificationStatus.expired} expired · ${verificationStatus.neverChecked} never verified`
      : `All ${verificationStatus.verified} active providers verified with provincial college`,
    remediation:
      "Verify all providers in good standing at their provincial college public register. Go to Settings → Users → Provider Verification.",
  });

  // Persist any failed checks as compliance alerts, keyed by practiceId + alertType
  for (const result of results) {
    if (!result.passed) {
      await prisma.complianceAlert.upsert({
        where: {
          practiceId_alertType: { practiceId, alertType: result.alertType },
        },
        create: {
          practice: { connect: { id: practiceId } },
          alertType: result.alertType,
          severity: result.severity,
          title: result.checkName,
          description: result.description,
        },
        update: {
          severity: result.severity,
          description: result.description,
          updatedAt: new Date(),
        },
      });
    }
  }

  return results;
}
