import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export default async function AnalyticsPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findFirst({
    where: { active: true },
    select: { practiceId: true },
  });

  const practiceId = dbUser?.practiceId;

  const now = new Date();
  const thisMonth = { gte: startOfMonth(now), lte: endOfMonth(now) };
  const lastMonth = { gte: startOfMonth(subMonths(now, 1)), lte: endOfMonth(subMonths(now, 1)) };

  const [
    encountersThisMonth,
    encountersLastMonth,
    finalizedNotes,
    aiInteractions,
    rejectedClaims,
    totalClaims,
  ] = await Promise.all([
    prisma.encounter.count({ where: { practiceId, encounterDate: thisMonth, deletedAt: null } }),
    prisma.encounter.count({ where: { practiceId, encounterDate: lastMonth, deletedAt: null } }),
    prisma.encounterNote.count({ where: { encounter: { practiceId }, finalizedAt: { not: null } } }),
    prisma.aIInteraction.count({ where: { encounter: { practiceId } } }),
    prisma.claimSubmission.count({ where: { practiceId, status: "rejected" } }),
    prisma.claimSubmission.count({ where: { practiceId } }),
  ]);

  const encounterGrowth = encountersLastMonth > 0
    ? Math.round(((encountersThisMonth - encountersLastMonth) / encountersLastMonth) * 100)
    : 0;

  const rejectionRate = totalClaims > 0 ? Math.round((rejectedClaims / totalClaims) * 100) : 0;

  const stats = [
    { label: "Encounters this month", value: encountersThisMonth.toString(), sub: `${encounterGrowth >= 0 ? "+" : ""}${encounterGrowth}% vs last month`, positive: encounterGrowth >= 0 },
    { label: "Finalized notes",       value: finalizedNotes.toString(),       sub: "All time",                        positive: true },
    { label: "AI interactions",       value: aiInteractions.toString(),       sub: "Note gen + coding",               positive: true },
    { label: "Claim rejection rate",  value: `${rejectionRate}%`,             sub: `${rejectedClaims} of ${totalClaims} claims`, positive: rejectionRate < 10 },
  ];

  const targets = [
    { label: "Note acceptance rate",   target: "80%",      note: "Track via AI interactions" },
    { label: "Coding accuracy",        target: "90%",      note: "Track via provider accept/reject" },
    { label: "Claim rejection rate",   target: "< 5%",     note: "AHCIP administrative rejection rate" },
    { label: "Prior auth turnaround",  target: "< 24 hrs", note: "Supplemental insurer PA (Alberta Blue Cross, Sun Life)" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/50 text-sm mt-0.5">Practice performance and AI efficiency metrics</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
            <div className="font-medium text-white/80 text-sm">{s.label}</div>
            <div className={`text-xs mt-0.5 ${s.positive ? "text-green-400" : "text-red-400"}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">AI Performance Targets</h2>
        <div className="space-y-0.5">
          {targets.map((m) => (
            <div key={m.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div>
                <div className="text-sm font-medium text-white">{m.label}</div>
                <div className="text-xs text-white/40 mt-0.5">{m.note}</div>
              </div>
              <div className="text-sm font-semibold text-blue-400">{m.target}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
