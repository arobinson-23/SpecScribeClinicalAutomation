"use client";

import { Plus, Trash2, Sparkles } from "lucide-react";
import type { StepTherapyEntry } from "@/types/prior-auth";

interface StepTherapyTableProps {
  entries: StepTherapyEntry[];
  onChange: (entries: StepTherapyEntry[]) => void;
  generating: boolean;
  onGenerate: () => void;
  hasNotes: boolean;
}

function EditableCell({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full bg-transparent text-xs text-white/80 placeholder-white/20 outline-none resize-none leading-relaxed";
  return multiline ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className={cls}
    />
  ) : (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
    />
  );
}

function emptyEntry(): StepTherapyEntry {
  return {
    id: crypto.randomUUID(),
    drugOrTherapy: "",
    startDate: null,
    duration: "",
    reasonForFailure: "",
    supportingEvidence: null,
    dsmCode: null,
    isAiGenerated: false,
  };
}

export function StepTherapyTable({
  entries,
  onChange,
  generating,
  onGenerate,
  hasNotes,
}: StepTherapyTableProps) {
  function updateRow(id: string, patch: Partial<StepTherapyEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeRow(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  function addRow() {
    onChange([...entries, emptyEntry()]);
  }

  return (
    <div className="space-y-4">
      {/* Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white/70">Previous Interventions (FAILED)</h3>
          <p className="text-[10px] text-white/30 mt-0.5">
            AI scans session transcripts and notes to extract documented treatment failures.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !hasNotes}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-40 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg transition-all"
        >
          <Sparkles className={`h-3.5 w-3.5 ${generating ? "animate-pulse" : ""}`} />
          {generating ? "Analyzing Notes…" : "Generate from Notes"}
        </button>
      </div>

      {!hasNotes && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-300">
          No finalized clinical notes found for this encounter. Add step therapy entries manually.
        </div>
      )}

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.03] border-b border-white/10">
            <tr>
              <th className="text-left px-3 py-2.5 font-bold text-white/40 uppercase tracking-wider w-[28%]">
                Drug / Therapy
              </th>
              <th className="text-left px-3 py-2.5 font-bold text-white/40 uppercase tracking-wider w-[18%]">
                Duration
              </th>
              <th className="text-left px-3 py-2.5 font-bold text-white/40 uppercase tracking-wider">
                Reason for Failure
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-white/20 text-[11px]">
                  No prior interventions documented. Click "Generate from Notes" or add manually.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="group hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 align-top">
                  <div className="flex items-start gap-1.5">
                    {entry.isAiGenerated && (
                      <span className="shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                        AI
                      </span>
                    )}
                    <EditableCell
                      value={entry.drugOrTherapy}
                      onChange={(v) => updateRow(entry.id, { drugOrTherapy: v })}
                      placeholder="e.g. Sertraline 200mg/day"
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <EditableCell
                    value={entry.duration}
                    onChange={(v) => updateRow(entry.id, { duration: v })}
                    placeholder="e.g. 12 weeks"
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <EditableCell
                    value={entry.reasonForFailure}
                    onChange={(v) => updateRow(entry.id, { reasonForFailure: v })}
                    placeholder="e.g. Inadequate response after 12 weeks at therapeutic dose"
                    multiline
                  />
                </td>
                <td className="px-2 py-2.5 align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(entry.id)}
                    className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-[11px] text-white/40 hover:text-white/70 font-bold transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add Row Manually
      </button>
    </div>
  );
}
