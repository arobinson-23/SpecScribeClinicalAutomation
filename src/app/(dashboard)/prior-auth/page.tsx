import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { format } from "date-fns";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  not_required:       "bg-white/10 text-white/50",
  pending_submission: "bg-yellow-500/10 text-yellow-400",
  submitted:          "bg-blue-500/10 text-blue-400",
  under_review:       "bg-purple-500/10 text-purple-400",
  approved:           "bg-green-500/10 text-green-400",
  rejected:           "bg-red-500/10 text-red-400",
  appealed:           "bg-orange-500/10 text-orange-400",
  expired:            "bg-white/10 text-white/50",
};

export default async function PriorAuthPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { practiceId: true },
  });

  const practiceId = dbUser?.practiceId;

  const priorAuths = await prisma.priorAuthRequest.findMany({
    where: { practiceId },
    include: {
      encounter: {
        include: { patient: { select: { firstName: true, lastName: true, mrn: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = {
    pending:  priorAuths.filter((p) => ["pending_submission", "submitted", "under_review"].includes(p.status)).length,
    approved: priorAuths.filter((p) => p.status === "approved").length,
    rejected: priorAuths.filter((p) => p.status === "denied").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Prior Authorizations</h1>
        <p className="text-white/50 text-sm mt-0.5">Track and manage payer prior authorization requests</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.pending}</div>
          <div className="text-sm text-white/50">Pending / In review</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-green-400 mb-1">{stats.approved}</div>
          <div className="text-sm text-white/50">Approved</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="text-3xl font-bold text-red-400 mb-1">{stats.rejected}</div>
          <div className="text-sm text-white/50">Rejected (appeal eligible)</div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-white/50">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Payer</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Procedure(s)</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Status</th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Submitted</th>
              <th className="text-right px-4 py-3 font-medium text-white/50">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {priorAuths.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-white/30">
                  No prior auth requests yet. They will appear here when created from an encounter.
                </td>
              </tr>
            )}
            {priorAuths.map((pa) => {
              const codes = (pa.procedureCodes as string[]).join(", ");
              return (
                <tr key={pa.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      MRN: {pa.encounter.patient.mrn}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60">{pa.payerName}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono text-white/70">{codes}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[pa.status] ?? ""}`}>
                      {pa.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {pa.submittedAt ? format(new Date(pa.submittedAt), "MMM d") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/encounters/${pa.encounterId}`}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
