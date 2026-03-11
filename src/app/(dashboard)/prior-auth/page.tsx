import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { PriorAuthDashboard } from "./components/PriorAuthDashboard";

export default async function PriorAuthPage() {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect("/sign-in");
  }

  const { practiceId } = dbUser;

  const priorAuthsRaw = await prisma.priorAuthRequest.findMany({
    where: { practiceId },
    include: {
      encounter: {
        include: {
          patient: { select: { firstName: true, lastName: true, phn: true } }
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const priorAuths = priorAuthsRaw.map(pa => ({
    ...pa,
    patientName: `${decryptPHISafe(pa.encounter.patient.firstName) || "Unknown"} ${decryptPHISafe(pa.encounter.patient.lastName) || "Patient"}`,
    patientPhn: pa.encounter.patient.phn || "N/A"
  }));

  const stats = {
    pending: priorAuths.filter((p) => ["pending_submission", "submitted", "under_review"].includes(p.status)).length,
    approved: priorAuths.filter((p) => p.status === "approved").length,
    rejected: priorAuths.filter((p) => p.status === "denied").length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 bg-blue-500 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80">Revenue Cycle Management</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Prior Authorizations</h1>
          <p className="text-white/40 text-sm font-medium">Streamline medical necessity documentation and payer approvals.</p>
        </div>
        {hasPermission(dbUser.role, "prior_auth", "create") && (
          <Link
            href="/prior-auth/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] mt-2"
          >
            <Plus className="h-4 w-4" />
            New Authorization
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md hover:border-yellow-500/30 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-white/40 uppercase tracking-widest group-hover:text-yellow-500/50 transition-colors">Queue</div>
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
          </div>
          <div className="text-4xl font-black text-yellow-400 tabular-nums">{stats.pending}</div>
          <p className="text-[10px] text-white/30 font-bold uppercase mt-2 tracking-tighter">Requires Action or In Review</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md hover:border-green-500/30 transition-all group">
          <div className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2 group-hover:text-green-500/50 transition-colors">Approved</div>
          <div className="text-4xl font-black text-green-400 tabular-nums">{stats.approved}</div>
          <p className="text-[10px] text-white/30 font-bold uppercase mt-2 tracking-tighter">Ready for Billing</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md hover:border-red-500/30 transition-all group">
          <div className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2 group-hover:text-red-500/50 transition-colors">Denied</div>
          <div className="text-4xl font-black text-red-500 tabular-nums">{stats.rejected}</div>
          <p className="text-[10px] text-white/30 font-bold uppercase mt-2 tracking-tighter">Appeal Eligible</p>
        </div>
      </div>

      <PriorAuthDashboard initialPriorAuths={priorAuths} />
    </div>
  );
}
