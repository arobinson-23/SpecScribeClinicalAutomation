"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ShieldCheck, RefreshCw, Loader2, CheckSquare, Square } from "lucide-react";
import { signOffValidation } from "./actions";
import type { SamplePatientRecord } from "@/app/api/migration/sample-records/route";

function formatDob(dob: string): string {
  if (!dob || dob === "[encrypted]") return dob;
  const [y, m, d] = dob.split("-");
  return `${d}/${m}/${y}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ValidationDashboard() {
  const [records, setRecords] = useState<SamplePatientRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSample = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/migration/sample-records");
      const json = await res.json() as { data: { records: SamplePatientRecord[] } | null; error: string | null };
      if (!res.ok || json.error) {
        toast.error(json.error ?? "Failed to load sample records");
        return;
      }
      setRecords(json.data?.records ?? []);
      setLoaded(true);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleRecord = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  };

  const handleSignOff = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one record to sign off");
      return;
    }
    setSigningOff(true);
    try {
      const result = await signOffValidation(Array.from(selected));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Signed off ${result.count} record${result.count !== 1 ? "s" : ""} — logged to HIA audit trail`);
      setSelected(new Set());
      // Reload to reflect sign-off state
      await loadSample();
    } finally {
      setSigningOff(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <h2 className="font-semibold text-white/80 text-sm">Validation Dashboard</h2>
          <span className="text-xs text-white/30">— Custodian sign-off (HIA §57)</span>
        </div>
        <button
          onClick={loadSample}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loaded ? "Refresh" : "Load sample"}
        </button>
      </div>

      {!loaded ? (
        <div className="p-10 text-center">
          <p className="text-white/30 text-sm mb-4">
            Load the 10 most recently imported records for accuracy review before signing off.
          </p>
          <button
            onClick={loadSample}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Load 10 Sample Records
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-white/40 text-sm">No recently imported records found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-white/50 hover:text-white transition-colors">
                      {selected.size === records.length
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">PHN (MRN)</th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">DOB</th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">Sex</th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">Legacy ID</th>
                  <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase tracking-wider">Imported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => toggleRecord(r.id)}
                    className={`cursor-pointer transition-colors ${
                      selected.has(r.id)
                        ? "bg-green-500/5 hover:bg-green-500/10"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      {selected.has(r.id)
                        ? <CheckSquare className="w-4 h-4 text-green-400" />
                        : <Square className="w-4 h-4 text-white/20" />
                      }
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{r.mrn}</td>
                    <td className="px-4 py-3 text-white/80 font-medium">{r.firstName} {r.lastName}</td>
                    <td className="px-4 py-3 text-white/60">{formatDob(r.dob)}</td>
                    <td className="px-4 py-3 text-white/50 capitalize">{r.sex ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40">{r.legacyId || "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/40">{formatDate(r.importedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
            <p className="text-xs text-white/40">
              {selected.size} of {records.length} record{records.length !== 1 ? "s" : ""} selected for sign-off
            </p>
            <button
              onClick={handleSignOff}
              disabled={selected.size === 0 || signingOff}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {signingOff
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing off…</>
                : <><ShieldCheck className="w-4 h-4" /> Sign Off Selected</>
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
}
