"use client";

import type { ReactNode } from "react";
import { ShieldCheck, Bot, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ALBERTA_PAYER_CONFIG, type AlbertaPayerPreset, type ClinicalJustification, type EncounterContext, type PayerSpecificData, type StepTherapyEntry } from "@/types/prior-auth";

interface ReviewAndSignProps {
  context: EncounterContext;
  payerPreset: AlbertaPayerPreset;
  payerData: PayerSpecificData;
  procedureCodes: string[];
  diagnosisCodes: string[];
  stepTherapy: StepTherapyEntry[];
  justification: ClinicalJustification;
  attestationChecked: boolean;
  onAttestationChange: (v: boolean) => void;
  onSign: () => void;
  submitting: boolean;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 mb-1.5">
      {children}
    </div>
  );
}

function PreviewBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.02] border border-white/8 rounded-lg p-3 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function ReviewAndSign({
  context,
  payerPreset,
  payerData,
  procedureCodes,
  diagnosisCodes,
  stepTherapy,
  justification,
  attestationChecked,
  onAttestationChange,
  onSign,
  submitting,
}: ReviewAndSignProps) {
  const payer = ALBERTA_PAYER_CONFIG[payerPreset];
  const today = format(new Date(), "MMMM d, yyyy");
  const canSign = attestationChecked && !submitting;

  return (
    <div className="space-y-6">
      {/* Preview panel */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
            Prior Authorization Preview
          </h3>
          <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Draft
          </span>
        </div>

        <div className="p-5 space-y-5 max-h-[420px] overflow-y-auto custom-scrollbar text-[12px]">
          {/* Header */}
          <div className="text-center border-b border-white/10 pb-4">
            <div className="text-base font-black text-white uppercase tracking-wide">
              Prior Authorization Request
            </div>
            <div className="text-white/50 text-xs mt-1">
              {payer.name} — Behavioral Health
            </div>
            <div className="text-white/30 text-[11px] mt-0.5">Date: {today}</div>
          </div>

          {/* Patient */}
          <div>
            <SectionLabel>Patient Information</SectionLabel>
            <PreviewBlock>
              <div className="grid grid-cols-3 gap-3 text-[11px]">
                <div>
                  <div className="text-white/30 text-[10px]">Legal Name</div>
                  <div className="text-white font-semibold">{context.patientName}</div>
                </div>
                <div>
                  <div className="text-white/30 text-[10px]">Date of Birth</div>
                  <div className="text-white/80">{context.dob ?? "—"}</div>
                </div>
                <div>
                  <div className="text-white/30 text-[10px]">PHN / ULI</div>
                  <div className="text-white/80 font-mono">{context.phn ?? "Not on file"}</div>
                </div>
              </div>
            </PreviewBlock>
          </div>

          {/* Payer & Codes */}
          <div>
            <SectionLabel>Authorization Request</SectionLabel>
            <PreviewBlock>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="text-white/30 text-[10px]">Payer</div>
                  <div className="text-white">{payer.name}</div>
                  {payerData.ahcipPhysicianId && <div className="text-white/40 text-[10px]">AHCIP ID: {payerData.ahcipPhysicianId}</div>}
                  {payerData.groupPlanNumber && <div className="text-white/40 text-[10px]">Plan: {payerData.groupPlanNumber}</div>}
                  {payerData.aishStatus && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-500/15 text-blue-400 text-[9px] font-bold rounded uppercase tracking-wider">AISH</span>
                  )}
                </div>
                <div>
                  <div className="text-white/30 text-[10px]">Codes Requested</div>
                  <div className="text-white">{procedureCodes.join(", ") || "—"}</div>
                  <div className="text-white/40 text-[10px] mt-1">Dx: {diagnosisCodes.join(", ") || "—"}</div>
                </div>
              </div>
            </PreviewBlock>
          </div>

          {/* Step Therapy */}
          {stepTherapy.length > 0 && (
            <div>
              <SectionLabel>Step Therapy — Previous Interventions (Failed)</SectionLabel>
              <PreviewBlock className="p-0 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Drug / Therapy</th>
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Duration</th>
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Reason for Failure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stepTherapy.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 text-white/80">{e.drugOrTherapy}</td>
                        <td className="px-3 py-2 text-white/60">{e.duration}</td>
                        <td className="px-3 py-2 text-white/60">{e.reasonForFailure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PreviewBlock>
            </div>
          )}

          {/* Clinical Summary */}
          <div>
            <SectionLabel>Clinical Summary</SectionLabel>
            <PreviewBlock>
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                {justification.clinicalSummary || "—"}
              </p>
            </PreviewBlock>
          </div>

          {/* Medical Necessity */}
          <div>
            <SectionLabel>Statement of Medical Necessity</SectionLabel>
            <PreviewBlock>
              <p className="text-white/70 leading-relaxed italic whitespace-pre-wrap">
                {justification.medicalNecessityStatement || "—"}
              </p>
            </PreviewBlock>
          </div>

          {/* Provider */}
          <div>
            <SectionLabel>Ordering Provider</SectionLabel>
            <PreviewBlock>
              <div className="text-[11px] space-y-0.5">
                <div className="text-white font-semibold">
                  {context.providerName}
                  {context.providerCredentials && `, ${context.providerCredentials}`}
                </div>
                {context.providerRegistrationNumber && (
                  <div className="text-white/40">
                    CPSA Reg #{context.providerRegistrationNumber}
                  </div>
                )}
              </div>
            </PreviewBlock>
          </div>

          {/* Documentation gaps */}
          {justification.missingDocumentation.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Documentation Gaps — Resolve Before Submission
                </span>
              </div>
              <ul className="space-y-0.5">
                {justification.missingDocumentation.map((item, i) => (
                  <li key={i} className="text-[11px] text-amber-200/70">• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Scribe Disclosure Footer */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2.5">
              <Bot className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-[10px] text-white/40 leading-tight">
                <strong className="text-white/60">Generated by AI Scribe — SpecScribe</strong>
                {" "}This prior authorization was drafted using AI assistance and reviewed and approved by the ordering provider. In compliance with CPSA Standards of Practice (2026) and OIPC guidelines, the provider accepts full clinical responsibility for the accuracy and completeness of this submission.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attestation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={attestationChecked}
            onChange={(e) => onAttestationChange(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${attestationChecked ? "bg-blue-600 border-blue-600" : "border-white/20 bg-white/5"}`}>
            {attestationChecked && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">
            Physician Attestation (Required — CPSA / OIPC 2026)
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">
            I, <strong className="text-white/60">{context.providerName}{context.providerCredentials ? `, ${context.providerCredentials}` : ""}</strong>
            {context.providerRegistrationNumber && ` (CPSA Reg #${context.providerRegistrationNumber})`}, verify that the information in this prior authorization request is clinically accurate and complete. I accept full clinical responsibility for this submission in accordance with CPSA Standards of Practice and applicable Alberta health privacy legislation (HIA / PIPEDA).
          </p>
        </div>
      </label>

      {/* Sign button */}
      <button
        type="button"
        onClick={onSign}
        disabled={!canSign}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-lg active:scale-[0.99]"
      >
        <ShieldCheck className="h-4 w-4" />
        {submitting ? "Encrypting & Signing…" : "Sign & Submit for Authorization"}
      </button>

      <p className="text-center text-[10px] text-white/25">
        Signing creates an immutable audit record under HIA (Alberta) s.35(1) and PIPEDA s.4.7. PHI is encrypted at rest using AES-256-GCM.
      </p>
    </div>
  );
}
