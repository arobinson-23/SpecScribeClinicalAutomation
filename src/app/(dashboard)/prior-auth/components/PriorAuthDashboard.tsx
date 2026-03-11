"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Loader2, FileX, AlertCircle, ChevronRight, X,
  Save, Edit3, CheckCircle2, FileText, Building2,
  Hash, Calendar, User, Stethoscope, ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SmartPdfRecommender } from "./SmartPdfRecommender";

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  not_required:       { label: "Not Required",       color: "bg-white/10 text-white/50 border border-white/10",         dot: "bg-white/30" },
  pending_submission: { label: "Pending Submission",  color: "bg-amber-500/15 text-amber-400 border border-amber-500/25", dot: "bg-amber-400 animate-pulse" },
  submitted:          { label: "Submitted",           color: "bg-blue-500/15 text-blue-400 border border-blue-500/25",   dot: "bg-blue-400" },
  under_review:       { label: "Under Review",        color: "bg-purple-500/15 text-purple-400 border border-purple-500/25", dot: "bg-purple-400 animate-pulse" },
  approved:           { label: "Approved",            color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", dot: "bg-emerald-400" },
  denied:             { label: "Denied",              color: "bg-red-500/15 text-red-400 border border-red-500/25",     dot: "bg-red-400" },
  appealed:           { label: "Appealed",            color: "bg-orange-500/15 text-orange-400 border border-orange-500/25", dot: "bg-orange-400" },
  expired:            { label: "Expired",             color: "bg-white/10 text-white/30 border border-white/10",         dot: "bg-white/30" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-white/10 text-white/40 border border-white/10", dot: "bg-white/30" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2.5 border-b border-white/[0.05] last:border-0 items-start">
      <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider pt-0.5">{label}</span>
      <div className="text-[13px] text-white/80">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-1">
      <Icon className="h-3.5 w-3.5 text-white/25" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{label}</span>
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[11px] font-mono text-white/65">
      {code}
    </span>
  );
}

interface PriorAuthDashboardProps {
  initialPriorAuths: any[];
}

export function PriorAuthDashboard({ initialPriorAuths }: PriorAuthDashboardProps) {
  const [priorAuths, setPriorAuths] = useState(initialPriorAuths);
  const [selectedPaId, setSelectedPaId] = useState<string | null>(null);
  const [selectedPa, setSelectedPa] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPaDetail = useCallback(async (id: string) => {
    setLoading(true);
    setIsEditing(false);
    try {
      const res = await fetch(`/api/prior-auth/${id}`);
      if (!res.ok) throw new Error("Failed to fetch detail");
      const { data } = await res.json();
      setSelectedPa(data);
    } catch {
      toast.error("Could not load prior authorization details.");
    } finally {
      setLoading(false);
    }
  }, []);

  function closePanel() {
    setSelectedPaId(null);
    setSelectedPa(null);
    setIsEditing(false);
  }

  async function handleUpdate() {
    if (!selectedPa) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/prior-auth/${selectedPa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicalSummary: selectedPa.clinicalSummary,
          medicalNecessityStatement: selectedPa.medicalNecessityStatement,
          authNumber: selectedPa.authNumber,
          status: selectedPa.status,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Prior authorization updated.");
      setIsEditing(false);
      setPriorAuths(prev => prev.map(pa => pa.id === selectedPa.id ? { ...pa, status: selectedPa.status } : pa));
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-white/40 text-xs uppercase tracking-wider">Patient</th>
              <th className="text-left px-4 py-3 font-semibold text-white/40 text-xs uppercase tracking-wider">Payer</th>
              <th className="text-left px-4 py-3 font-semibold text-white/40 text-xs uppercase tracking-wider">Procedures</th>
              <th className="text-left px-4 py-3 font-semibold text-white/40 text-xs uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-white/40 text-xs uppercase tracking-wider">Created</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {priorAuths.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-white/25 text-sm">
                  No prior authorizations yet. Generate one from an encounter's billing codes page.
                </td>
              </tr>
            )}
            {priorAuths.map((pa) => {
              const procCodes = (pa.procedureCodes as string[] ?? []).join(", ");
              const isSelected = pa.id === selectedPaId;
              return (
                <tr
                  key={pa.id}
                  onClick={() => { setSelectedPaId(pa.id); fetchPaDetail(pa.id); }}
                  className={`group cursor-pointer transition-colors ${isSelected ? "bg-blue-600/[0.08]" : "hover:bg-white/[0.025]"}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white text-[13px]">{pa.patientName}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-0.5">PHN {pa.patientPhn}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-white/60">{pa.payerName}</td>
                  <td className="px-4 py-3">
                    <code className="text-[11px] bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded font-mono text-white/50 truncate max-w-[140px] block">{procCodes || "—"}</code>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={pa.status} /></td>
                  <td className="px-4 py-3 text-[12px] text-white/35">
                    {pa.createdAt ? format(new Date(pa.createdAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className={`h-4 w-4 ml-auto transition-colors ${isSelected ? "text-blue-400" : "text-white/20 group-hover:text-white/50"}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detail Panel ──────────────────────────────────────────────────── */}
      {selectedPaId && (
        <div className="fixed inset-y-0 right-0 w-[640px] bg-[#0c0f1d] border-l border-white/[0.08] shadow-2xl z-50 flex flex-col">

          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-white/[0.07] bg-white/[0.02] flex items-start justify-between gap-4 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400/60">Prior Authorization</span>
              </div>
              <div className="font-mono text-[11px] text-white/25 truncate">
                REF: {selectedPaId.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedPa && <StatusBadge status={selectedPa.status} />}
              <button onClick={closePanel} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-colors ml-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="h-7 w-7 text-blue-500 animate-spin mx-auto" />
                  <p className="text-xs text-white/30">Loading authorization details…</p>
                </div>
              </div>
            ) : selectedPa && (
              <div className="divide-y divide-white/[0.05]">

                {/* ── Section 1: Overview ─────────────────────────────── */}
                <div className="px-6 py-5">
                  <SectionHeader icon={ClipboardList} label="Request Overview" />
                  <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.07] bg-white/[0.02] px-4">
                    <FieldRow label="Patient">
                      <span className="font-semibold text-white">
                        {priorAuths.find(p => p.id === selectedPaId)?.patientName ?? "—"}
                      </span>
                      {priorAuths.find(p => p.id === selectedPaId)?.patientPhn && (
                        <div className="text-[11px] text-white/30 font-mono mt-0.5">
                          PHN {priorAuths.find(p => p.id === selectedPaId)?.patientPhn}
                        </div>
                      )}
                    </FieldRow>
                    <FieldRow label="Payer">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-white/25 shrink-0" />
                        {selectedPa.payerName || "—"}
                      </span>
                    </FieldRow>
                    <FieldRow label="Auth Number">
                      {isEditing ? (
                        <input
                          value={selectedPa.authNumber ?? ""}
                          onChange={(e) => setSelectedPa({ ...selectedPa, authNumber: e.target.value })}
                          placeholder="Enter when approved"
                          className="w-full bg-transparent border-b border-white/20 focus:border-blue-500/60 outline-none py-0.5 text-[13px] text-white placeholder:text-white/20 font-mono"
                        />
                      ) : (
                        <span className="font-mono text-white/60">{selectedPa.authNumber || <span className="text-white/25 italic text-[12px]">Not yet assigned</span>}</span>
                      )}
                    </FieldRow>
                    <FieldRow label="Status">
                      {isEditing ? (
                        <select
                          value={selectedPa.status}
                          onChange={(e) => setSelectedPa({ ...selectedPa, status: e.target.value })}
                          className="bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-blue-500/50 transition-colors"
                        >
                          <option value="pending_submission">Pending Submission</option>
                          <option value="submitted">Submitted</option>
                          <option value="under_review">Under Review</option>
                          <option value="approved">Approved</option>
                          <option value="denied">Denied</option>
                          <option value="appealed">Appealed</option>
                        </select>
                      ) : (
                        <StatusBadge status={selectedPa.status} />
                      )}
                    </FieldRow>
                    <FieldRow label="Created">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-white/25 shrink-0" />
                        {selectedPa.createdAt ? format(new Date(selectedPa.createdAt), "MMMM d, yyyy 'at' h:mm a") : "—"}
                      </span>
                    </FieldRow>
                    {selectedPa.submittedAt && (
                      <FieldRow label="Submitted">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-white/25 shrink-0" />
                          {format(new Date(selectedPa.submittedAt), "MMMM d, yyyy")}
                        </span>
                      </FieldRow>
                    )}
                    {selectedPa.physicianSignedAt && (
                      <FieldRow label="Physician Signed">
                        <span className="flex items-center gap-1.5 text-emerald-400/80">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(selectedPa.physicianSignedAt), "MMMM d, yyyy")}
                        </span>
                      </FieldRow>
                    )}
                  </div>
                </div>

                {/* ── Section 2: Requested Services ───────────────────── */}
                <div className="px-6 py-5">
                  <SectionHeader icon={Stethoscope} label="Requested Services" />
                  <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.07] bg-white/[0.02] px-4">
                    <FieldRow label="Procedure Codes">
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedPa.procedureCodes as string[] ?? []).length > 0
                          ? (selectedPa.procedureCodes as string[]).map((c: string) => <CodeChip key={c} code={c} />)
                          : <span className="text-white/25 italic text-[12px]">None recorded</span>
                        }
                      </div>
                    </FieldRow>
                    <FieldRow label="Diagnosis Codes">
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedPa.diagnosisCodes as string[] ?? []).length > 0
                          ? (selectedPa.diagnosisCodes as string[]).map((c: string) => <CodeChip key={c} code={c} />)
                          : <span className="text-white/25 italic text-[12px]">None recorded</span>
                        }
                      </div>
                    </FieldRow>
                    {selectedPa.dsmCodes && (selectedPa.dsmCodes as string[]).length > 0 && (
                      <FieldRow label="DSM-5 Codes">
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedPa.dsmCodes as string[]).map((c: string) => <CodeChip key={c} code={c} />)}
                        </div>
                      </FieldRow>
                    )}
                  </div>
                </div>

                {/* ── Section 3: Clinical Summary ──────────────────────── */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between pb-2 mb-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-white/25" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">AI Clinical Summary</span>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 transition-colors"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={selectedPa.clinicalSummary ?? ""}
                      onChange={(e) => setSelectedPa({ ...selectedPa, clinicalSummary: e.target.value })}
                      rows={8}
                      className="w-full bg-white/[0.03] border border-white/10 focus:border-blue-500/40 rounded-xl p-4 text-[13px] text-white/80 leading-relaxed outline-none resize-none transition-colors placeholder:text-white/20"
                      placeholder="Clinical summary will appear here…"
                    />
                  ) : (
                    <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4 text-[13px] text-white/70 leading-[1.75] whitespace-pre-wrap">
                      {selectedPa.clinicalSummary || <span className="italic text-white/25">No summary generated.</span>}
                    </div>
                  )}
                </div>

                {/* ── Section 4: Medical Necessity ─────────────────────── */}
                <div className="px-6 py-5">
                  <SectionHeader icon={Hash} label="Medical Necessity Statement" />
                  {isEditing ? (
                    <textarea
                      value={selectedPa.medicalNecessityStatement ?? ""}
                      onChange={(e) => setSelectedPa({ ...selectedPa, medicalNecessityStatement: e.target.value })}
                      rows={5}
                      className="w-full bg-white/[0.03] border border-white/10 focus:border-blue-500/40 rounded-xl p-4 text-[13px] text-white/80 leading-relaxed outline-none resize-none transition-colors placeholder:text-white/20"
                      placeholder="Medical necessity statement…"
                    />
                  ) : (
                    <blockquote className="border-l-2 border-blue-500/30 pl-4 text-[13px] text-white/65 leading-[1.75] italic">
                      {selectedPa.medicalNecessityStatement || <span className="text-white/25 not-italic">Statement pending.</span>}
                    </blockquote>
                  )}
                </div>

                {/* ── Section 5: Documentation Gaps ───────────────────── */}
                {selectedPa.missingDocumentation && (selectedPa.missingDocumentation as string[]).length > 0 && (
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-2 pb-3">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500/60 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60">
                        Documentation Gaps ({(selectedPa.missingDocumentation as string[]).length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(selectedPa.missingDocumentation as string[]).map((flag: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 bg-amber-500/[0.07] border border-amber-500/15 rounded-lg px-4 py-3">
                          <FileX className="h-3.5 w-3.5 text-amber-500/70 shrink-0 mt-0.5" />
                          <span className="text-[12px] text-amber-200/70 leading-snug">{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Section 6: Smart PDF Export ──────────────────────── */}
                <SmartPdfRecommender
                  patientName={priorAuths.find((p) => p.id === selectedPaId)?.patientName ?? ""}
                  clinicalSummary={selectedPa.clinicalSummary ?? null}
                  medicalNecessityStatement={selectedPa.medicalNecessityStatement ?? null}
                  procedureCodes={(selectedPa.procedureCodes as string[]) ?? []}
                  diagnosisCodes={(selectedPa.diagnosisCodes as string[]) ?? []}
                  dsmCodes={(selectedPa.dsmCodes as string[]) ?? []}
                  stepTherapy={
                    Array.isArray(selectedPa.stepTherapyJson)
                      ? (selectedPa.stepTherapyJson as Array<{
                          drugOrTherapy: string;
                          duration: string;
                          reasonForFailure: string;
                          startDate?: string | null;
                          supportingEvidence?: string;
                          dsmCode?: string;
                        }>)
                      : []
                  }
                  payerPreset={selectedPa.payerPreset ?? null}
                  payerName={selectedPa.payerName ?? ""}
                />

              </div>
            )}
          </div>

          {/* ── Panel Footer ────────────────────────────────────────────── */}
          {!loading && selectedPa && (
            <div className="px-6 py-4 border-t border-white/[0.07] bg-white/[0.015] shrink-0">
              {isEditing ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-white/50 hover:text-white/80 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    onClick={handleUpdate}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/90 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                  <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]">
                    <CheckCircle2 className="h-4 w-4" /> Submit to Payer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {selectedPaId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={closePanel}
        />
      )}
    </div>
  );
}
