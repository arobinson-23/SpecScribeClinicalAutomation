import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { isEpicConfigured } from "@/lib/fhir/epic";
import { EhrSyncButton } from "@/components/ehr/EhrSyncButton";
import { ClientRow } from "./client-row";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ai_processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  needs_review: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  finalized: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ai_processing: "AI processing",
  needs_review: "Needs review",
  finalized: "Finalized",
};

export default async function EncountersPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Find the user in our database to get their practiceId
  // For now, we'll try to match by clerkId if we had it, or just use a fallback for demo
  const dbUser = await prisma.user.findFirst({
    where: { active: true }, // In a real app, we'd filter by clerkId or email
    select: { practiceId: true }
  });

  const practiceId = dbUser?.practiceId;

  // ── EHR status for the sync button ──────────────────────────────────────
  let ehrConnected = false;
  let ehrLastSyncAt: string | null = null;

  if (practiceId && isEpicConfigured()) {
    const practice = await prisma.practice.findFirst({
      where: { id: practiceId, deletedAt: null },
      select: { ehrLastSyncAt: true, fhirBaseUrl: true },
    });
    ehrConnected = !!practice?.fhirBaseUrl;
    ehrLastSyncAt = practice?.ehrLastSyncAt?.toISOString() ?? null;
  }

  const encounters = await prisma.encounter.findMany({
    where: { practiceId, deletedAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true, phn: true } },
      provider: { select: { firstName: true, lastName: true, credentials: true } },
      notes: { select: { finalizedAt: true } },
    },
    orderBy: { encounterDate: "desc" },
    take: 50,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Encounters</h1>
          <p className="text-white/60 text-sm mt-0.5">Manage clinical encounters and documentation</p>
        </div>
        <div className="flex items-center gap-3">
          <EhrSyncButton
            initialConnected={ehrConnected}
            lastSyncAt={ehrLastSyncAt}
          />
          <Link
            href="/encounters/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New encounter
          </Link>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-white/40 uppercase tracking-wider text-[10px]">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-white/40 uppercase tracking-wider text-[10px]">Date</th>
              <th className="text-left px-4 py-3 font-medium text-white/40 uppercase tracking-wider text-[10px]">Provider</th>
              <th className="text-left px-4 py-3 font-medium text-white/40 uppercase tracking-wider text-[10px]">Status</th>
              <th className="text-right px-4 py-3 font-medium text-white/40 uppercase tracking-wider text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {encounters.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">
                  No encounters yet. Create your first encounter to get started.
                </td>
              </tr>
            )}
            {encounters.map((enc) => {
              const firstName = decryptPHISafe(enc.patient.firstName) ?? "";
              const lastName = decryptPHISafe(enc.patient.lastName) ?? "";
              const provFirst = decryptPHISafe(enc.provider.firstName) ?? "";
              const provLast = decryptPHISafe(enc.provider.lastName) ?? "";
              const phn = enc.patient.phn ?? "";
              return (
                <ClientRow
                  key={enc.id}
                  href={`/encounters/${enc.id}`}
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{lastName}, {firstName}</div>
                    <div className="text-xs text-white/40 font-mono">PHN: {phn}</div>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {format(new Date(enc.encounterDate), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {provFirst} {provLast}
                    {enc.provider.credentials && (
                      <span className="text-white/40">, {enc.provider.credentials}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[enc.status] ?? ""}`}>
                      {STATUS_LABELS[enc.status] ?? enc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/encounters/${enc.id}`}
                      className="text-blue-400 group-hover:text-blue-300 font-bold text-[10px] uppercase tracking-wider"
                    >
                      Open Note →
                    </Link>
                  </td>
                </ClientRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
