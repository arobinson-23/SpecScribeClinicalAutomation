import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { runComplianceChecks } from "@/lib/compliance/hipaa-checks";
import { prisma } from "@/lib/db/client";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";

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

export default async function CompliancePage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { practiceId: true },
  });

  const practiceId = dbUser?.practiceId;

  if (!practiceId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
          <p className="text-white/50 text-sm mt-0.5">PIPEDA &amp; HIA security checks, alerts, and audit status</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-10 text-center">
          <p className="text-white/40 text-sm">No practice data found. Contact support to complete your practice setup.</p>
        </div>
      </div>
    );
  }

  const [checks, alerts] = await Promise.all([
    runComplianceChecks(practiceId),
    prisma.complianceAlert.findMany({
      where: { practiceId, resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const score = Math.round(
    (checks.filter((c: any) => c.passed).length / checks.length) * 100
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
            {alerts.filter((a: any) => a.severity === "critical").length}
          </div>
          <div className="text-sm text-white/50">Critical alerts</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-white mb-1">
            {checks.filter((c: any) => c.passed).length}/{checks.length}
          </div>
          <div className="text-sm text-white/50">Checks passed</div>
        </div>
      </div>

      {/* HIPAA Checks */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <h2 className="font-semibold text-white/80 text-sm">PIPEDA (Federal) and HIA (Alberta) Checks</h2>
        </div>
        <div className="divide-y divide-white/5">
          {checks.map((check: any) => (
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

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <h2 className="font-semibold text-white/80 text-sm">Active Alerts ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-white/5">
            {alerts.map((alert: any) => (
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
