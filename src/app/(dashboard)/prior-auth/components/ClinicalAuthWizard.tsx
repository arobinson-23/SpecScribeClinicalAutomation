"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getEncounterContextAction,
  generateStepTherapyAction,
  generateJustificationAction,
  createAndSignPriorAuthAction,
} from "../actions";
import { PatientContextHeader } from "./PatientContextHeader";
import { AlbertaPayerSelector } from "./AlbertaPayerSelector";
import { StepTherapyTable } from "./StepTherapyTable";
import { ClinicalJustificationPanel } from "./ClinicalJustificationPanel";
import { ReviewAndSign } from "./ReviewAndSign";
import type {
  AlbertaPayerPreset,
  ClinicalJustification,
  EncounterContext,
  EncounterForAuth,
  PayerSpecificData,
  StepTherapyEntry,
} from "@/types/prior-auth";

interface ClinicalAuthWizardProps {
  encounters: EncounterForAuth[];
}

const STEPS = [
  { num: 1, label: "Encounter & Payer" },
  { num: 2, label: "Step Therapy" },
  { num: 3, label: "Justification" },
  { num: 4, label: "Review & Sign" },
] as const;

const EMPTY_JUSTIFICATION: ClinicalJustification = {
  clinicalSummary: "",
  medicalNecessityStatement: "",
  dsmCodes: [],
  missingDocumentation: [],
};

export function ClinicalAuthWizard({ encounters }: ClinicalAuthWizardProps) {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [encounterId, setEncounterId] = useState("");
  const [context, setContext] = useState<EncounterContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [payerPreset, setPayerPreset] = useState<AlbertaPayerPreset | "">("");
  const [payerData, setPayerData] = useState<PayerSpecificData>({});
  const [procedureCodes, setProcedureCodes] = useState("");
  const [diagnosisCodes, setDiagnosisCodes] = useState("");

  // Step 2
  const [stepTherapy, setStepTherapy] = useState<StepTherapyEntry[]>([]);
  const [stepTherapyGenerating, setStepTherapyGenerating] = useState(false);

  // Step 3
  const [justification, setJustification] = useState<ClinicalJustification>(EMPTY_JUSTIFICATION);
  const [justificationGenerating, setJustificationGenerating] = useState(false);

  // Step 4
  const [attestation, setAttestation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedEncounter = encounters.find((e) => e.id === encounterId);
  const parsedProcedureCodes = procedureCodes.split(",").map((c) => c.trim()).filter(Boolean);
  const parsedDiagnosisCodes = diagnosisCodes.split(",").map((c) => c.trim()).filter(Boolean);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleEncounterChange(id: string) {
    setEncounterId(id);
    setContext(null);
    if (!id) return;
    setContextLoading(true);
    try {
      const result = await getEncounterContextAction(id);
      if (result.success) {
        setContext(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to load patient context");
    } finally {
      setContextLoading(false);
    }
  }

  async function handleGenerateStepTherapy() {
    if (!encounterId) return;
    setStepTherapyGenerating(true);
    try {
      const result = await generateStepTherapyAction(encounterId);
      if (result.success) {
        setStepTherapy(result.data);
        if (result.data.length === 0) {
          toast.info("No prior treatment history found in notes. Add entries manually.");
        } else {
          toast.success(`Found ${result.data.length} prior intervention(s). Review and edit as needed.`);
        }
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Step therapy analysis failed");
    } finally {
      setStepTherapyGenerating(false);
    }
  }

  async function handleGenerateJustification() {
    if (!encounterId || !payerPreset) return;
    setJustificationGenerating(true);
    try {
      const result = await generateJustificationAction({
        encounterId,
        payerPreset: payerPreset as AlbertaPayerPreset,
        payerData,
        procedureCodes: parsedProcedureCodes,
        diagnosisCodes: parsedDiagnosisCodes,
        stepTherapy: stepTherapy.map(({ drugOrTherapy, duration, reasonForFailure }) => ({
          drugOrTherapy,
          duration,
          reasonForFailure,
        })),
      });
      if (result.success) {
        setJustification(result.data);
        toast.success("Clinical justification drafted. Review and edit before signing.");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Justification generation failed");
    } finally {
      setJustificationGenerating(false);
    }
  }

  async function handleSign() {
    if (!encounterId || !payerPreset || !context) return;
    setSubmitting(true);
    try {
      const result = await createAndSignPriorAuthAction({
        encounterId,
        payerPreset: payerPreset as AlbertaPayerPreset,
        payerData,
        procedureCodes: parsedProcedureCodes,
        diagnosisCodes: parsedDiagnosisCodes,
        stepTherapy: stepTherapy.map(({ id: _id, isAiGenerated: _ai, ...rest }) => rest),
        clinicalSummary: justification.clinicalSummary,
        medicalNecessityStatement: justification.medicalNecessityStatement,
        dsmCodes: justification.dsmCodes,
        missingDocumentation: justification.missingDocumentation,
      });
      if (result.success) {
        toast.success("Prior authorization signed and submitted for review.");
        router.push("/prior-auth");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Submission failed — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function canAdvanceStep1() {
    return !!encounterId && !!payerPreset && parsedProcedureCodes.length > 0 && parsedDiagnosisCodes.length > 0;
  }

  function canAdvanceStep2() {
    return true; // step therapy is optional — manual entry allowed
  }

  function canAdvanceStep3() {
    return justification.clinicalSummary.trim().length > 0 && justification.medicalNecessityStatement.trim().length > 0;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Patient context header — persistent once encounter selected */}
      {context && !contextLoading && <PatientContextHeader context={context} />}
      {contextLoading && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 animate-pulse h-20" />
      )}

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                  step === s.num
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : step > s.num
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}
              >
                {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
              </div>
              <span
                className={`text-[10px] font-bold mt-1 whitespace-nowrap transition-colors ${
                  step === s.num ? "text-blue-400" : step > s.num ? "text-green-400/60" : "text-white/20"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-16 mb-5 mx-1 transition-colors ${step > s.num ? "bg-green-500/25" : "bg-white/8"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">
        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                Select Encounter
              </label>
              <select
                value={encounterId}
                onChange={(e) => handleEncounterChange(e.target.value)}
                className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              >
                <option value="" className="bg-[#0E1521]">Choose an encounter…</option>
                {encounters.map((enc) => (
                  <option key={enc.id} value={enc.id} className="bg-[#0E1521]">
                    {enc.patientName} — {format(new Date(enc.encounterDate), "MMM d, yyyy")}
                    {enc.hasNote ? " ✓" : " (no note)"}
                  </option>
                ))}
              </select>
            </div>

            <AlbertaPayerSelector
              selected={payerPreset}
              payerData={payerData}
              onPayerChange={setPayerPreset}
              onPayerDataChange={setPayerData}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                  Procedure Code(s) <span className="normal-case text-white/25">(comma-separated, e.g. 08.19A)</span>
                </label>
                <input
                  type="text"
                  value={procedureCodes}
                  onChange={(e) => setProcedureCodes(e.target.value)}
                  placeholder="08.19A, 03.04A"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                  Diagnosis Code(s) <span className="normal-case text-white/25">(ICD-10-CA)</span>
                </label>
                <input
                  type="text"
                  value={diagnosisCodes}
                  onChange={(e) => setDiagnosisCodes(e.target.value)}
                  placeholder="F33.2, F41.1"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <StepTherapyTable
            entries={stepTherapy}
            onChange={setStepTherapy}
            generating={stepTherapyGenerating}
            onGenerate={handleGenerateStepTherapy}
            hasNotes={selectedEncounter?.hasNote ?? false}
          />
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <ClinicalJustificationPanel
            justification={justification}
            onChange={setJustification}
            generating={justificationGenerating}
            onGenerate={handleGenerateJustification}
            hasNotes={selectedEncounter?.hasNote ?? false}
            hasCodes={parsedProcedureCodes.length > 0 && parsedDiagnosisCodes.length > 0}
          />
        )}

        {/* ── Step 4 ── */}
        {step === 4 && context && payerPreset && (
          <ReviewAndSign
            context={context}
            payerPreset={payerPreset as AlbertaPayerPreset}
            payerData={payerData}
            procedureCodes={parsedProcedureCodes}
            diagnosisCodes={parsedDiagnosisCodes}
            stepTherapy={stepTherapy}
            justification={justification}
            attestationChecked={attestation}
            onAttestationChange={setAttestation}
            onSign={handleSign}
            submitting={submitting}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/60 hover:text-white text-sm font-bold transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
            disabled={
              (step === 1 && !canAdvanceStep1()) ||
              (step === 2 && !canAdvanceStep2()) ||
              (step === 3 && !canAdvanceStep3())
            }
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-lg active:scale-[0.98]"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
