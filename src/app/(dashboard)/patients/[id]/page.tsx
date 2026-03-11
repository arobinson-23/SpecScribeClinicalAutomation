import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getDbUser } from "@/lib/auth/get-db-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { decryptPHISafe } from "@/lib/db/encryption";
import { writeAuditLog } from "@/lib/db/audit";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { EncounterStatus, NoteType } from "@prisma/client";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<EncounterStatus, { label: string; cls: string }> = {
  not_started:    { label: "Not Started",    cls: "bg-white/10 text-white/50" },
  in_progress:    { label: "In Progress",    cls: "bg-amber-500/15 text-amber-400" },
  ai_processing:  { label: "AI Processing",  cls: "bg-blue-500/15 text-blue-400" },
  needs_review:   { label: "Needs Review",   cls: "bg-orange-500/15 text-orange-400" },
  note_finalized: { label: "Note Finalized", cls: "bg-purple-500/15 text-purple-400" },
  finalized:      { label: "Finalized",      cls: "bg-emerald-500/15 text-emerald-400" },
};

const NOTE_LABELS: Record<NoteType, string> = {
  progress_note:   "Progress Note",
  intake:          "Intake",
  biopsychosocial: "Biopsychosocial",
  treatment_plan:  "Treatment Plan",
  procedure:       "Procedure",
  consultation:    "Consultation",
  discharge:       "Discharge",
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const dbUser = await getDbUser();
  if (!dbUser) redirect("/sign-in");
  if (!hasPermission(dbUser.role, "patients", "read")) redirect("/403");

  const { id } = await params;
  const { practiceId, id: userId } = dbUser;

  const patient = await prisma.patient.findFirst({
    where: { id, practiceId, deletedAt: null },
    include: {
      encounters: {
        where: { deletedAt: null },
        orderBy: { encounterDate: "desc" },
        include: {
          provider: { select: { firstName: true, lastName: true, credentials: true } },
          notes: {
            select: { noteType: true, noteFormat: true, finalizedAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!patient) notFound();

  await writeAuditLog({
    practiceId,
    userId,
    action: "READ",
    resource: "patient",
    resourceId: id,
    fieldsAccessed: ["firstName", "lastName", "dob", "sex", "phone", "email"],
    metadata: { encounterCount: patient.encounters.length },
  });

  const firstName = decryptPHISafe(patient.firstName) ?? "[encrypted]";
  const lastName  = decryptPHISafe(patient.lastName)  ?? "[encrypted]";
  const dob       = decryptPHISafe(patient.dob)       ?? null;
  const phone     = patient.phone ? (decryptPHISafe(patient.phone) ?? null) : null;
  const email     = patient.email ? (decryptPHISafe(patient.email) ?? null) : null;
  const lastVisit = patient.encounters[0]?.encounterDate ?? null;
  const canStartEncounter = hasPermission(dbUser.role, "own_encounters", "create");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/patients"
          className="mt-1 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              {lastName}, {firstName}
            </h1>
            <span className="font-mono text-xs bg-white/[0.06] border border-white/10 text-white/60 px-2 py-0.5 rounded-md">
              {patient.phn}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                patient.active
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {patient.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-white/40 text-sm mt-1">
            {patient.encounters.length} encounter{patient.encounters.length !== 1 ? "s" : ""}
            {lastVisit ? ` · Last visit ${fmt(lastVisit)}` : ""}
            {" · Added "}{fmt(patient.createdAt)}
          </p>
        </div>
      </div>

      {/* Demographics */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
          Demographics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-white/40 mb-1">Date of Birth</p>
            <p className="text-sm text-white font-medium">{fmt(dob)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Sex</p>
            <p className="text-sm text-white font-medium capitalize">{patient.sex ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Phone</p>
            <p className="text-sm text-white font-medium">{phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Email</p>
            <p className="text-sm text-white font-medium truncate">{email ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Encounters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Encounters
          </h2>
          {canStartEncounter && (
            <Link
              href={`/encounters/new?patientId=${id}`}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              + New Encounter
            </Link>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Note</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {patient.encounters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-white/30 text-sm">
                    No encounters yet.
                  </td>
                </tr>
              ) : (
                patient.encounters.map((enc) => {
                  const badge = STATUS_BADGE[enc.status];
                  const providerName = [
                    decryptPHISafe(enc.provider.firstName),
                    decryptPHISafe(enc.provider.lastName),
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const note = enc.notes[0];

                  return (
                    <tr key={enc.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-white/80">{fmt(enc.encounterDate)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {providerName || "—"}
                        {enc.provider.credentials && (
                          <span className="text-white/40 ml-1 text-xs">
                            {enc.provider.credentials}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {note ? NOTE_LABELS[note.noteType] : "—"}
                        {note?.noteFormat && (
                          <span className="text-white/30 ml-1 text-xs">({note.noteFormat})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/encounters/${enc.id}`}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
