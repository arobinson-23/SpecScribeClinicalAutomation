import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/get-db-user";
import { runComplianceChecks } from "@/lib/compliance/pipeda-checks";
import type { ComplianceCheckResult } from "@/lib/compliance/pipeda-checks";
import { getPracticeVerificationStatus } from "@/lib/compliance/oig-screening";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import { prisma } from "@/lib/db/client";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { ComplianceAlert } from "@prisma/client";

type Severity = "info" | "warning" | "critical";

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  info:     <Info className="h-4 w-4 text-blue-400" />,
  warning:  <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  critical: <ShieldAlert className="h-4 w-4 text-red-400" />,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  info:     "border-blue-500/20 bg-blue-500/5",
  warning:  "border-yellow-500/20 bg-yellow-500/5",
  critical: "border-red-500/20 bg-red-500/5",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  info:     "text-blue-400 bg-blue-500/10",
  warning:  "text-yellow-400 bg-yellow-500/10",
  critical: "text-red-400 bg-red-500/10",
};

const VERIFICATION_BADGE: Record<string, string> = {
  verified:             "text-green-400 bg-green-500/10",
  expired:              "text-yellow-400 bg-yellow-500/10",
  not_in_good_standing: "text-red-400 bg-red-500/10",
  never_checked:        "text-white/40 bg-white/5",
};

const VERIFICATION_LABEL: Record<string, string> = {
  verified:             "Verified",
  expired:              "Expired",
  not_in_good_standing: "Not in Good Standing",
  never_checked:        "Not Verified",
};

export default async function CompliancePage() {
  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");

  const { practiceId, id: userId, role } = dbUser;

  const [checks, alerts, verificationStatus] = await Promise.all([
    runComplianceChecks(practiceId),
    prisma.complianceAlert.findMany({
      where: { practiceId, resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    getPracticeVerificationStatus(practiceId),
  ]);

  // Audit log: reading provider names (PHI) for the verification table
  if (verificationStatus.providers.length > 0) {
    await writeAuditLog({
      practiceId,
      userId,
      userRole: role,
      action: "READ",
      resource: "provider_verification",
      outcome: "success",
      fieldsAccessed: ["firstName", "lastName"],
    });
  }

  const score = Math.round(
    (checks.filter((c: ComplianceCheckResult) => c.passed).length / checks.length) * 100,
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
        <p className="text-white/50 text-sm mt-0.5">PIPEDA &amp; HIA security checks, alerts, and audit status</p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-white mb-1">{score}%</div>
          <div className="text-sm text-white/50">Compliance score</div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full">
            <div
              className={`h-1.5 rounded-full transition-all ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-red-400 mb-1">
            {alerts.filter((a: ComplianceAlert) => a.severity === "critical").length}
          </div>
          <div className="text-sm text-white/50">Critical alerts</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-white mb-1">
            {checks.filter((c: ComplianceCheckResult) => c.passed).length}/{checks.length}
          </div>
          <div className="text-sm text-white/50">Checks passed</div>
        </div>
      </div>

      {/* PIPEDA Checks */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <h2 className="font-semibold text-white/80 text-sm">PIPEDA (Federal) and HIA (Alberta) Checks</h2>
        </div>
        <div className="divide-y divide-white/5">
          {checks.map((check: ComplianceCheckResult) => (
            <div key={check.checkName} className="flex items-start gap-3 px-4 py-3">
              {check.passed
                ? <ShieldCheck className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                : SEVERITY_ICON[check.severity as Severity]
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{check.checkName}</span>
                  {check.passed
                    ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Passed</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SEVERITY_BADGE[check.severity as Severity]}`}>{check.severity}</span>
                  }
                </div>
                <p className="text-xs text-white/40 mt-0.5">{check.description}</p>
                {!check.passed && (
                  <p className="text-xs text-white/60 mt-1 font-medium">{check.remediation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider College Verification */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <h2 className="font-semibold text-white/80 text-sm">Provider College Verification</h2>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="text-green-400">{verificationStatus.verified} verified</span>
            {verificationStatus.expired > 0 && <span className="text-yellow-400">{verificationStatus.expired} expired</span>}
            {verificationStatus.neverChecked > 0 && <span className="text-white/40">{verificationStatus.neverChecked} not checked</span>}
            {verificationStatus.notInGoodStanding > 0 && <span className="text-red-400">{verificationStatus.notInGoodStanding} not in good standing</span>}
          </div>
        </div>
        {verificationStatus.providers.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">
            No active providers found in this practice.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 bg-white/[0.01]">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Provider</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Province / College</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Registration #</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Last Verified</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Expires</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {verificationStatus.providers.map((p) => {
                const firstName = decryptPHISafe(p.firstName) ?? "—";
                const lastName = decryptPHISafe(p.lastName) ?? "—";
                const needsAction = p.status !== "verified";
                return (
                  <tr key={p.userId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">{firstName} {lastName}</div>
                      {p.credentials && <div className="text-xs text-white/30">{p.credentials}</div>}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {p.province ? (
                        <a
                          href={p.registerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          {p.province} / {p.college}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-white/30">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">
                      {p.registrationNumber ?? <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${VERIFICATION_BADGE[p.status]}`}>
                        {VERIFICATION_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {p.latestVerification
                        ? format(new Date(p.latestVerification.verifiedAt), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {p.latestVerification
                        ? format(new Date(p.latestVerification.expiresAt), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {needsAction && (
                        <a
                          href="/settings/users"
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Verify →
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <h2 className="font-semibold text-white/80 text-sm">Active Alerts ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-white/5">
            {alerts.map((alert: ComplianceAlert) => (
              <div key={alert.id} className={`mx-4 my-2 border rounded-lg p-3 ${SEVERITY_COLORS[alert.severity as Severity]}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  {SEVERITY_ICON[alert.severity as Severity]}
                  <span className="text-sm font-medium text-white">{alert.title}</span>
                </div>
                <p className="text-xs text-white/50 ml-6">{alert.description}</p>
                <p className="text-xs text-white/30 ml-6 mt-1">{format(new Date(alert.createdAt), "MMM d, yyyy HH:mm")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
