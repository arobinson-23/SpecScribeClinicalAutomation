import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClinicalMetrics } from "@/components/dashboard/ClinicalMetrics";
import { ActiveScribe } from "@/components/dashboard/ActiveScribe";
import { EncounterList } from "@/components/dashboard/EncounterList";
import { ComplianceModule } from "@/components/dashboard/ComplianceModule";
import { AIInsightsSidebar } from "@/components/dashboard/AIInsightsSidebar";
import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";

export default async function DashboardPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const user = await currentUser();

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
                                    4 drafts
                                </Link>{" "}
                                waiting for finalization today.
                            </p>
                        </header>

                        {/* Core Analytics */}
                        <ClinicalMetrics />

                        {/* Active Workzone */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <ActiveScribe />
                                <EncounterList />
                            </div>
                            <div className="space-y-8">
                                <ComplianceModule />

                                {/* EHR Sync Status */}
                                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">EHR Sync Status</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-white/60">Epic/Hyperspace</span>
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                Connected
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-white/60">MediTech</span>
                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                                Disabled
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Sidebar (Desktop Only) */}
                    <div className="hidden xl:block">
                        <AIInsightsSidebar />
                    </div>
                </main>
            </div>
        </div>
    );
}
