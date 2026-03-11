"use client";

import { Sparkles, AlertCircle, Tag } from "lucide-react";
import type { ClinicalJustification } from "@/types/prior-auth";

interface ClinicalJustificationPanelProps {
  justification: ClinicalJustification;
  onChange: (j: ClinicalJustification) => void;
  generating: boolean;
  onGenerate: () => void;
  hasNotes: boolean;
  hasCodes: boolean;
}

export function ClinicalJustificationPanel({
  justification,
  onChange,
  generating,
  onGenerate,
  hasNotes,
  hasCodes,
}: ClinicalJustificationPanelProps) {
  const canGenerate = hasNotes && hasCodes;

  function update(patch: Partial<ClinicalJustification>) {
    onChange({ ...justification, ...patch });
  }

  return (
    <div className="space-y-6">
      {/* Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white/70">Behavioral Health Clinical Justification</h3>
          <p className="text-[10px] text-white/30 mt-0.5">
            AI drafts medical necessity using DSM-5 criteria, functional impairments, and step therapy evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !canGenerate}
          title={!canGenerate ? "Select payer, add codes, and ensure encounter has clinical notes" : undefined}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-40 border border-purple-500/30 text-purple-400 text-xs font-bold rounded-lg transition-all"
        >
          <Sparkles className={`h-3.5 w-3.5 ${generating ? "animate-pulse" : ""}`} />
          {generating ? "Drafting Justification…" : "Generate Justification"}
        </button>
      </div>

      {!hasNotes && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-300">
          No clinical notes found. Add a clinical note to the encounter before generating a justification.
        </div>
      )}

      {/* DSM-5 / ICD-10-CA codes */}
      {justification.dsmCodes.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="h-3 w-3 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
              DSM-5 / ICD-10-CA Codes Referenced
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {justification.dsmCodes.map((code) => (
              <span
                key={code}
                className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono font-bold text-cyan-400"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Summary */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#06B6D4] mb-2">
          AI Clinical Summary
        </label>
        <textarea
          value={justification.clinicalSummary}
          onChange={(e) => update({ clinicalSummary: e.target.value })}
          rows={5}
          placeholder="Clinical summary will be generated here. You may edit this text before signing."
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-[13px] font-sans text-white/80 leading-relaxed outline-none focus:border-blue-500/40 resize-none transition-colors placeholder-white/20"
        />
      </div>

      {/* Medical Necessity Statement */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mb-2">
          Statement of Medical Necessity
        </label>
        <p className="text-[10px] text-white/30 mb-2">
          Focus on functional impairments (e.g., inability to maintain employment, ADL deficits) and link to DSM-5 diagnostic criteria.
        </p>
        <textarea
          value={justification.medicalNecessityStatement}
          onChange={(e) => update({ medicalNecessityStatement: e.target.value })}
          rows={8}
          placeholder="The patient presents with… [AI will draft this from clinical notes and step therapy history]"
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 text-[13px] font-sans text-white/80 leading-relaxed outline-none focus:border-purple-500/40 resize-none transition-colors placeholder-white/20 italic"
        />
      </div>

      {/* Documentation gaps */}
      {justification.missingDocumentation.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
              Potential Documentation Gaps
            </span>
          </div>
          <div className="space-y-1.5">
            {justification.missingDocumentation.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2"
              >
                <span className="text-amber-500 mt-0.5 shrink-0 text-xs">⚠</span>
                <span className="text-[11px] text-amber-200/80 leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
