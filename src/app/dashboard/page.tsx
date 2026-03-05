import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/get-db-user";
import { writeAuditLog } from "@/lib/db/audit";
import {
    getDashboardMetrics,
    getRecentEncounters,
    getComplianceAlerts,
    getLatestPendingEncounterCodes,
} from "@/lib/dashboard/queries";
import { ClinicalMetrics } from "@/components/dashboard/ClinicalMetrics";
import { ActiveScribe } from "@/components/dashboard/ActiveScribe";
import { EncounterList } from "@/components/dashboard/EncounterList";
import { ComplianceModule } from "@/components/dashboard/ComplianceModule";
import { AIInsightsSidebar } from "@/components/dashboard/AIInsightsSidebar";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";
import { EhrSyncStatus } from "@/components/dashboard/EhrSyncStatus";

export default async function DashboardPage() {
    try {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const user = await currentUser();

    const dbUser = await getDbUser();

    if (!dbUser) {
        redirect("/sign-in");
    }

    const [metrics, encounters, alerts, latestCodes] = await Promise.all([
        getDashboardMetrics(dbUser.practiceId),
        getRecentEncounters(dbUser.practiceId),
        getComplianceAlerts(dbUser.practiceId),
        getLatestPendingEncounterCodes(dbUser.practiceId),
    ]);

    await writeAuditLog({
        practiceId: dbUser.practiceId,
        userId: dbUser.id,
        action: "READ",
        resource: "dashboard",
        fieldsAccessed: ["encounter.count", "encounterNote.finalizedAt", "complianceAlert.severity"],
    });

    const draftCount = encounters.filter((e) => e.status !== "finalized").length;

    return (
        <div className="flex h-screen overflow-hidden bg-[#0b0d17] text-white selection:bg-blue-500/30">
            <CollapsibleSidebar />

            <div className="flex-1 overflow-y-auto">
                <main className="py-8 px-8 max-w-7xl mx-auto flex gap-8">
                    <div className="flex-1 space-y-8 min-w-0">
                        {/* Welcome Header */}
                        <header>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                    Clinical Command Center
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                    v2.4.0-pro
                                </span>
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                                Welcome back, Dr. {user?.lastName || user?.firstName || 'Practitioner'}
                            </h1>
                            <p className="text-white/40 font-medium">
                                You have{" "}
                                <Link
                                    href="/encounters"
                                    className="text-white hover:text-blue-400 border-b border-white/20 hover:border-blue-400 transition-all cursor-pointer"
                                >
                                    {draftCount} {draftCount === 1 ? "draft" : "drafts"}
                                </Link>{" "}
                                waiting for finalization today.
                            </p>
                        </header>

                        {/* Core Analytics */}
                        <ClinicalMetrics metrics={metrics} />

                        {/* Active Workzone */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <ActiveScribe />
                                <EncounterList encounters={encounters} />
                            </div>
                            <div className="space-y-8">
                                <ComplianceModule alerts={alerts} />

                                <EhrSyncStatus />
                            </div>
                        </div>
                    </div>

                    {/* Floating Sidebar (Desktop Only) */}
                    <div className="hidden xl:block">
                        <AIInsightsSidebar latestCodes={latestCodes} />
                    </div>
                </main>
            </div>
        </div>
    );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return (
            <div className="min-h-screen bg-[#0b0d17] text-white p-8 font-mono">
                <h1 className="text-red-400 text-xl font-bold mb-4">Dashboard Error (debug)</h1>
                <pre className="text-sm text-white/70 whitespace-pre-wrap">{message}</pre>
            </div>
        );
    }
}
