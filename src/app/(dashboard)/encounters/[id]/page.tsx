"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AudioRecorder } from "./components/AudioRecorder";
import { TranscriptViewer } from "./components/TranscriptViewer";
import { NoteEditor } from "./components/NoteEditor";
import { CodingSuggestions } from "./components/CodingSuggestions";
import type { TranscriptSegment } from "@/types/encounter";

const DEFAULT_NOTE_TYPE = "progress_note";
const DEFAULT_NOTE_FORMAT = "SOAP";

interface EncounterNote {
  id: string;
  noteType: string;
  noteFormat: string;
  aiGeneratedNote: string | null;
  finalizedAt: string | null;
}

interface EncounterData {
  status: string;
  notes: EncounterNote[];
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

  // On mount: check if an AI note was already generated (e.g. from dashboard ActiveScribe redirect)
  useEffect(() => {
    async function loadEncounter() {
      try {
        const res = await fetch(`/api/encounters/${encounterId}`);
        if (!res.ok) return;
        const { data } = await res.json() as { data: EncounterData };
        const note = data?.notes?.[0];
        if (note?.aiGeneratedNote && data.status === "needs_review") {
          setInitialNoteId(note.id);
          setInitialNote(note.aiGeneratedNote);
          setStep("review");
        }
      } catch {
        // Non-fatal — fall through to normal record step
      }
    }
    loadEncounter();
  }, [encounterId]);

  function handleTranscriptReady(t: string, segs: unknown[]) {
    setTranscript(t);
    setSegments(segs as TranscriptSegment[]);
    setStep("review");
  }

  function handleNoteFinalized(noteId: string, _noteText?: string) {
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
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-black text-blue-400 uppercase tracking-widest">
              Encounter Documentation
            </span>
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  step === s.key
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
                noteType={DEFAULT_NOTE_TYPE}
                noteFormat={DEFAULT_NOTE_FORMAT}
                onNoteFinalized={handleNoteFinalized}
              />
            </>
          )}

          {/* Step 3: Coding */}
          {step === "code" && finalizedNoteId && (
            <CodingSuggestions
              encounterId={encounterId}
              noteId={finalizedNoteId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
