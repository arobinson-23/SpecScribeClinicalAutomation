import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { MigrationUpload } from "./MigrationUpload";
import { ValidationDashboard } from "./ValidationDashboard";

export default async function MigrationPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { role: true, practiceId: true },
  });

  // RBAC: admin and superadmin only
  if (!dbUser || (dbUser.role !== "admin" && dbUser.role !== "superadmin")) {
    redirect("/403");
  }

  // Recent migration log summary (last 50 entries)
  const recentLogs = await prisma.migrationLog.findMany({
    where: { practiceId: dbUser.practiceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      recordType: true,
      status: true,
      sourceFile: true,
      createdAt: true,
    },
  });

  const stats = {
    patientsImported: recentLogs.filter((l) => l.action === "PATIENT_IMPORT" && l.status === "success").length,
    notesUploaded:    recentLogs.filter((l) => l.action === "NOTE_IMPORT"    && l.status === "success").length,
    signOffs:         recentLogs.filter((l) => l.action === "VALIDATION_SIGN_OFF").length,
    errors:           recentLogs.filter((l) => l.status === "error").length,
  };

  const STATUS_COLORS: Record<string, string> = {
    success:   "bg-green-500/10  text-green-400  border-green-500/20",
    duplicate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    no_match:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
    skipped:   "bg-slate-500/10  text-slate-400  border-slate-500/20",
    error:     "bg-red-500/10    text-red-400    border-red-500/20",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Data Migration Utility</h1>
        <p className="text-white/50 text-sm mt-0.5">
          Import Alberta EMR patient demographics and legacy clinical notes — HIA-compliant audit logging enabled
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Patients imported",   value: stats.patientsImported, color: "text-blue-400"   },
          { label: "Notes uploaded",      value: stats.notesUploaded,    color: "text-purple-400" },
          { label: "Custodian sign-offs", value: stats.signOffs,         color: "text-green-400"  },
          { label: "Errors (last 50)",    value: stats.errors,           color: stats.errors > 0 ? "text-red-400" : "text-white/40" },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Upload panels */}
        <MigrationUpload />

        {/* Validation / sign-off */}
        <ValidationDashboard />

        {/* Migration log table */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
            <h2 className="font-semibold text-white/80 text-sm">HIA Migration Log</h2>
            <p className="text-xs text-white/30 mt-0.5">Last 50 entries — immutable audit trail</p>
          </div>
          {recentLogs.length === 0 ? (
            <div className="p-10 text-center text-white/30 text-sm">No migration activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.02]">
                  <tr>
                    {["Timestamp", "Action", "Type", "Status", "Source File"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-xs text-white/40 whitespace-nowrap">
                        {log.createdAt.toLocaleString("en-CA", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/60">{log.action}</td>
                      <td className="px-4 py-2.5 text-xs text-white/50 capitalize">{log.recordType.replace("_", " ")}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_COLORS[log.status] ?? "text-white/40"}`}>
                          {log.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white/40 font-mono">{log.sourceFile ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
