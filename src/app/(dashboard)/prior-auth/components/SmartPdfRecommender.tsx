'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileDown,
  Loader2,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
  FORM_CONFIGS,
  FORM_IDS,
  type FormId,
  type PdfFormData,
  detectRecommendedForm,
  calculateDataMatch,
} from '@/lib/pdf/form-templates';
import { generatePrefilledPdf } from '@/lib/pdf/pdf-generator';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SmartPdfRecommenderProps {
  patientName: string;
  clinicalSummary: string | null;
  medicalNecessityStatement: string | null;
  procedureCodes: string[];
  diagnosisCodes: string[];
  dsmCodes: string[];
  stepTherapy: Array<{
    drugOrTherapy: string;
    duration: string;
    reasonForFailure: string;
    startDate?: string | null;
    supportingEvidence?: string;
    dsmCode?: string;
  }>;
  payerPreset: string | null;
  payerName: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SmartPdfRecommender(props: SmartPdfRecommenderProps) {
  const {
    patientName,
    clinicalSummary,
    medicalNecessityStatement,
    procedureCodes,
    diagnosisCodes,
    dsmCodes,
    stepTherapy,
    payerPreset,
    payerName,
  } = props;

  const [selectedForm, setSelectedForm] = useState<FormId | ''>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Keyword + payer-preset recommendation ────────────────────────────────────

  const recommendedForm = useMemo<FormId | null>(() => {
    const text = [clinicalSummary, medicalNecessityStatement, payerName]
      .filter(Boolean)
      .join(' ');
    return detectRecommendedForm(text, payerPreset);
  }, [clinicalSummary, medicalNecessityStatement, payerPreset, payerName]);

  // Auto-select the recommended form when the panel first opens
  useEffect(() => {
    if (recommendedForm && !selectedForm) {
      setSelectedForm(recommendedForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedForm]);

  // ── Data match score ─────────────────────────────────────────────────────────

  const formData = useMemo<PdfFormData>(
    () => ({
      patientName,
      clinicalSummary,
      medicalNecessityStatement,
      procedureCodes,
      diagnosisCodes,
      dsmCodes,
      stepTherapy,
      payerPreset,
      payerName,
      submissionDate: format(new Date(), 'yyyy-MM-dd'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      patientName,
      clinicalSummary,
      medicalNecessityStatement,
      procedureCodes,
      diagnosisCodes,
      dsmCodes,
      stepTherapy,
      payerPreset,
      payerName,
    ],
  );

  const dataMatchPercent = useMemo(
    () => (selectedForm ? calculateDataMatch(selectedForm, formData) : 0),
    [selectedForm, formData],
  );

  const isGoodMatch = dataMatchPercent >= 60;

  // ── Download handler ─────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!selectedForm) return;
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePrefilledPdf(selectedForm, formData);
      // Slice ensures a plain ArrayBuffer (not SharedArrayBuffer) for Blob compatibility
      const safeBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([safeBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${FORM_CONFIGS[selectedForm].shortLabel.replace(/\s+/g, '-')}_prefilled_${format(new Date(), 'yyyyMMdd')}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(`${FORM_CONFIGS[selectedForm].shortLabel} downloaded successfully.`);
    } catch (err) {
      // Log the error type only — no PHI values
      console.error('PDF generation failed:', err instanceof Error ? err.message : 'unknown');
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-5">

      {/* Section header */}
      <div className="flex items-center gap-2 pb-3">
        <FileDown className="h-3.5 w-3.5 text-violet-400/70" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400/60">
          Smart PDF Export
        </span>
      </div>

      {/* AI recommendation banner */}
      {recommendedForm && (
        <div className="flex items-start gap-2.5 mb-3 bg-violet-500/[0.07] border border-violet-500/20 rounded-xl px-3.5 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="min-w-0">
            <p className="text-[11px] text-violet-200/90 font-semibold leading-tight">
              AI recommends:{' '}
              <span className="text-violet-300">{FORM_CONFIGS[recommendedForm].shortLabel}</span>
            </p>
            <p className="text-[10px] text-violet-400/55 mt-0.5 leading-tight">
              Detected from keywords in clinical notes and payer preset
            </p>
          </div>
        </div>
      )}

      {/* Form selector dropdown */}
      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
          Form Template
        </label>
        <div className="relative">
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value as FormId | '')}
            className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-violet-500/50 rounded-xl px-3.5 py-2.5 text-[13px] text-white/80 outline-none transition-colors appearance-none cursor-pointer pr-9"
          >
            <option value="" className="bg-[#0c0f1d] text-white/40">
              — Select a form template —
            </option>
            {FORM_IDS.map((id) => (
              <option key={id} value={id} className="bg-[#0c0f1d] text-white/90">
                {FORM_CONFIGS[id].label}
                {id === recommendedForm ? ' ★' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        </div>
        {selectedForm && (
          <p className="text-[10px] text-white/30 mt-1.5 px-0.5 leading-snug">
            {FORM_CONFIGS[selectedForm].description}
          </p>
        )}
      </div>

      {/* Data match indicator */}
      {selectedForm && (
        <div className="mb-3 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
              Data Match
            </span>
            <div className="flex items-center gap-1.5">
              {isGoodMatch ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span
                className={`text-[16px] font-black leading-none ${
                  isGoodMatch ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {dataMatchPercent}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isGoodMatch ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${dataMatchPercent}%` }}
            />
          </div>

          <p className="text-[10px] text-white/35 leading-snug">
            {isGoodMatch
              ? `${dataMatchPercent}% of fields auto-populated from AI-generated clinical content.`
              : `${dataMatchPercent}% auto-populated — patient demographics (DOB, PHN) require manual entry.`}
          </p>

          {/* Field availability breakdown */}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
            {[
              { label: 'Patient name', ok: !!patientName },
              { label: 'Diagnosis codes', ok: diagnosisCodes.length > 0 },
              { label: 'Procedure codes', ok: procedureCodes.length > 0 },
              { label: 'Clinical summary', ok: !!clinicalSummary },
              { label: 'Medical necessity', ok: !!medicalNecessityStatement },
              { label: 'Step therapy', ok: stepTherapy.length > 0 },
              { label: 'DSM-5 codes', ok: dsmCodes.length > 0 },
            ].map(({ label, ok }) => (
              <span
                key={label}
                className={`text-[9px] font-semibold flex items-center gap-1 ${
                  ok ? 'text-emerald-400/70' : 'text-white/20'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    ok ? 'bg-emerald-400' : 'bg-white/15'
                  }`}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={!selectedForm || isGenerating}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating PDF…
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            Download Pre-filled PDF
          </>
        )}
      </button>

      {!selectedForm && (
        <p className="text-center text-[10px] text-white/20 mt-2">
          Select a form template above to enable download
        </p>
      )}

      <p className="text-[9px] text-white/20 mt-3 text-center leading-snug">
        Non-signature fields are locked per AHS security standards.
        Physician must sign and date before submission.
      </p>
    </div>
  );
}
