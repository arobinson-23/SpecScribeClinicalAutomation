"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AudioRecorder } from "./components/AudioRecorder";
import { TranscriptViewer } from "./components/TranscriptViewer";
import { NoteEditor } from "./components/NoteEditor";
import { CodingSuggestions } from "./components/CodingSuggestions";
import { DemoMode } from "./components/DemoMode";
import type { TranscriptSegment } from "@/types/encounter";

interface SavedCode {
  id: string;
  codeType: string;
  code: string;
  description: string | null;
  modifier: string | null;
  units: number;
  aiConfidence: number | null;
  aiRationale: string | null;
  providerAccepted: boolean | null;
  supersededAt: string | null;
  version: number;
}

interface EncounterNote {
  id: string;
  noteType: string;
  noteFormat: string;
  aiGeneratedNote: string | null;
  providerEditedNote: string | null;
  finalizedAt: string | null;
}

interface EncounterData {
  status: string;
  notes: EncounterNote[];
  codes: SavedCode[];
}

export default function EncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const encounterId = params.id;

  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [finalizedNoteId, setFinalizedNoteId] = useState<string | undefined>();
  const [step, setStep] = useState<"record" | "review" | "code">("record");
  const [initialNoteId, setInitialNoteId] = useState<string | undefined>();
  const [initialNote, setInitialNote] = useState<string | undefined>();
  const [savedCodes, setSavedCodes] = useState<SavedCode[]>([]);

  // Note type / format — can be overridden by Demo Mode
  const [noteType, setNoteType] = useState("progress_note");
  const [noteFormat, setNoteFormat] = useState("SOAP");
  const [patientContext, setPatientContext] = useState<{
    ageYears?: number;
    biologicalSex?: string;
    priorDiagnoses?: string[];
    currentMedications?: string[];
    chiefComplaint?: string;
  }>({});

  // On mount: check if AI note already generated (needs_review status)
  useEffect(() => {
    async function loadEncounter() {
      try {
        const res = await fetch(`/api/encounters/${encounterId}`);
        if (!res.ok) return;
        const { data } = await res.json() as { data: EncounterData };
        const note = data?.notes?.[0];

        // Restore saved codes (non-superseded rows)
        const activeCodes = (data?.codes ?? []).filter(c => !c.supersededAt);
        setSavedCodes(activeCodes);

        if (note && (note.providerEditedNote || note.aiGeneratedNote)) {
          setInitialNoteId(note.id);
          setInitialNote(note.providerEditedNote || note.aiGeneratedNote || undefined);
          setNoteType(note.noteType || "progress_note");
          setNoteFormat(note.noteFormat || "SOAP");

          if (note.finalizedAt) {
            setFinalizedNoteId(note.id);
            setStep("code");
          } else {
            setStep("review");
          }
        }
      } catch {
        // Non-fatal
      }
    }
    loadEncounter();
  }, [encounterId]);

  function handleTranscriptReady(t: string, segs: unknown[]) {
    setTranscript(t);
    setSegments(segs as TranscriptSegment[]);
    setStep("review");
  }

  function handleDemoNoteTypeChange(
    nt: string,
    nf: string,
    ctx: Record<string, unknown>
  ) {
    setNoteType(nt);
    setNoteFormat(nf);
    setPatientContext(ctx as typeof patientContext);
  }

  function handleNoteFinalized(noteId: string) {
    setFinalizedNoteId(noteId);
    setStep("code");
  }

  const steps = [
    { key: "record", label: "1. Record" },
    { key: "review", label: "2. Review note" },
    { key: "code", label: "3. Billing codes" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b0d17] text-white">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-black text-blue-400 uppercase tracking-widest">
                Encounter Documentation
              </span>
            </div>
            {/* Demo mode — only shown on record step */}
            {step === "record" && (
              <DemoMode
                onTranscriptReady={handleTranscriptReady}
                onNoteTypeChange={handleDemoNoteTypeChange}
              />
            )}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Encounter Documentation</h1>
          <p className="text-white/40 text-sm mt-1">
            Record or upload audio → AI generates a draft note → Review and finalize → AI suggests billing codes
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <button
                onClick={() => setStep(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${step === s.key
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {s.label}
              </button>
              {i < steps.length - 1 && <div className="w-4 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Note type pill — shown during review */}
        {step === "review" && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] text-white/30">Note format:</span>
            {(["SOAP", "DAP", "BIRP", "NARRATIVE"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setNoteFormat(fmt)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${noteFormat === fmt
                  ? "bg-blue-600/30 border border-blue-500/40 text-blue-300"
                  : "bg-white/[0.04] border border-white/10 text-white/30 hover:text-white/60"
                  }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {/* Step 1: Audio */}
          {step === "record" && (
            <AudioRecorder
              encounterId={encounterId}
              onTranscriptReady={handleTranscriptReady}
            />
          )}

          {/* Step 2: Note Review */}
          {step === "review" && (
            <>
              <TranscriptViewer transcript={transcript} segments={segments} />
              <NoteEditor
                encounterId={encounterId}
                noteId={initialNoteId}
                initialNote={initialNote}
                transcript={transcript}
                noteType={noteType}
                noteFormat={noteFormat}
                patientContext={patientContext}
                onNoteFinalized={handleNoteFinalized}
              />
            </>
          )}

          {/* Step 3: Coding */}
          {step === "code" && finalizedNoteId && (
            <CodingSuggestions
              encounterId={encounterId}
              noteId={finalizedNoteId}
              autoGenerate={savedCodes.length === 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
