"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, AlertCircle, Search, X, ChevronDown } from "lucide-react";
import { VolumeVisualizer } from "./VolumeVisualizer";
import { toast } from "sonner";

interface PatientResult {
  id: string;
  phn: string;
  firstName: string;
  lastName: string;
}

type ScribeState = "idle" | "modal" | "recording" | "uploading" | "generating";

const NOTE_TYPES = [
  { value: "progress_note", label: "Progress Note" },
  { value: "intake", label: "Intake / Initial Evaluation" },
  { value: "biopsychosocial", label: "Biopsychosocial Assessment" },
  { value: "treatment_plan", label: "Treatment Plan" },
] as const;

const NOTE_FORMATS = [
  { value: "SOAP", label: "SOAP" },
  { value: "DAP", label: "DAP" },
  { value: "BIRP", label: "BIRP" },
  { value: "NARRATIVE", label: "Narrative" },
] as const;

export function ActiveScribe() {
  const router = useRouter();

  const [scribeState, setScribeState] = useState<ScribeState>("idle");
  const [statusText, setStatusText] = useState("Waiting for voice input...");
  const [durationSecs, setDurationSecs] = useState(0);

  // Pre-session modal state
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noteType, setNoteType] = useState("progress_note");
  const [noteFormat, setNoteFormat] = useState("SOAP");
  const [encounterId, setEncounterId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Patient typeahead
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (patientSearch.length < 2) { setPatientResults([]); return; }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=8`);
        if (res.ok) {
          const { data } = await res.json() as { data: { items: PatientResult[] } };
          setPatientResults(data?.items ?? []);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [patientSearch]);

  const stopAudio = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => { return () => stopAudio(); }, [stopAudio]);

  async function handleStartSession() {
    if (!selectedPatient) { toast.error("Select a patient before starting"); return; }

    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientPhn: selectedPatient.phn,
          encounterDate: new Date().toISOString(),
          noteType,
          noteFormat,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        toast.error(error ?? "Could not create encounter");
        return;
      }

      const { data } = await res.json() as { data: { id: string } };
      setEncounterId(data.id);
      await startRecording();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus (Chrome); fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(500);
      mediaRecorderRef.current = recorder;

      setDurationSecs(0);
      timerRef.current = setInterval(() => setDurationSecs((s) => s + 1), 1000);
      setScribeState("recording");
      setStatusText("Ambient listening active. Speak clearly...");
    } catch {
      toast.error("Microphone access denied");
      setScribeState("idle");
    }
  }

  async function handleStopAndFinalize() {
    const currentEncounterId = encounterId;
    if (!currentEncounterId) { setScribeState("idle"); return; }

    // Stop recording and collect the blob
    const blob = await new Promise<Blob>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
        return;
      }
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    stopAudio();

    if (blob.size === 0) {
      setScribeState("idle");
      setStatusText("Waiting for voice input...");
      return;
    }

    setScribeState("uploading");
    setStatusText("Uploading audio securely to ca-central-1...");

    try {
      // Upload + transcribe (AWS Transcribe Medical, ca-central-1)
      const form = new FormData();
      form.append("audio", blob, "session.webm");
      form.append("encounterId", currentEncounterId);

      const transcribeRes = await fetch("/api/ai/transcribe", { method: "POST", body: form });
      if (!transcribeRes.ok) {
        toast.error("Transcription failed — navigate to encounter to retry");
        router.push(`/encounters/${currentEncounterId}`);
        return;
      }

      const { data: transcribeData } = await transcribeRes.json() as {
        data?: { transcript: string; segments: unknown[] };
      };

      if (!transcribeData?.transcript) {
        toast.error("No transcript returned — navigate to encounter to retry");
        router.push(`/encounters/${currentEncounterId}`);
        return;
      }

      setScribeState("generating");
      setStatusText("Generating clinical note with Claude AI...");

      // Generate AI note from transcript
      const noteRes = await fetch("/api/ai/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: currentEncounterId,
          transcript: transcribeData.transcript,
          noteType,
          noteFormat,
        }),
      });

      if (!noteRes.ok) {
        toast.error("Note generation failed — transcript saved, continue in encounter");
      } else {
        toast.success("AI note generated — review and finalize in the encounter");
      }

      router.push(`/encounters/${currentEncounterId}`);
    } catch {
      toast.error("Network error — navigating to encounter to retry");
      router.push(`/encounters/${currentEncounterId}`);
    }
  }

  const isActive = scribeState === "recording";
  const isBusy = scribeState === "uploading" || scribeState === "generating";

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Pre-session Modal */}
      {scribeState === "modal" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1120] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Start New Session</h2>
              <button onClick={() => setScribeState("idle")} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Patient Search */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by name or PHN..."
                  value={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.phn})` : patientSearch}
                  onChange={(e) => { setSelectedPatient(null); setPatientSearch(e.target.value); }}
                  onFocus={() => { if (selectedPatient) { setSelectedPatient(null); setPatientSearch(""); } }}
                  className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07]"
                />
                {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin" />}
              </div>

              {patientResults.length > 0 && !selectedPatient && (
                <div className="mt-1 bg-[#0f1120] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch(""); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm text-white">{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-white/40 group-hover:text-white/60 font-mono">{p.phn}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Note Type */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Note Type</label>
              <div className="relative">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  {NOTE_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-[#0f1120]">{t.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Note Format */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Format</label>
              <div className="grid grid-cols-4 gap-2">
                {NOTE_FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setNoteFormat(f.value)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${noteFormat === f.value ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartSession}
              disabled={!selectedPatient}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all"
            >
              <Mic className="w-4 h-4" />
              Start Recording
            </button>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-red-500 animate-pulse" : isBusy ? "bg-amber-500 animate-pulse" : "bg-white/20"}`} />
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest">Live Session</h3>
            </div>
            {isActive && <VolumeVisualizer stream={streamRef.current} isActive />}
          </div>

          {isActive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono">
                {formatDuration(durationSecs)}
              </span>
            </div>
          )}
        </div>

        <div className="min-h-[140px] border-l-2 border-white/10 pl-6 py-2">
          <p className={`text-lg font-medium leading-relaxed ${isActive ? "text-white" : isBusy ? "text-amber-400" : "text-white/30 italic"}`}>
            {statusText}
          </p>
          {isBusy && (
            <div className="flex items-center gap-2 mt-4 text-blue-400 text-sm animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{scribeState === "uploading" ? "Transcribing with AWS Medical AI (ca-central-1)..." : "Sending to Claude..."}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span>HIA Audit Trail: Active</span>
          </div>
          <span>AWS ca-central-1 · TLS 1.3</span>
        </div>

        <div className={`absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full transition-opacity duration-1000 ${isActive ? "opacity-100" : "opacity-0"}`} />
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={() => {
            if (scribeState === "recording") handleStopAndFinalize();
            else if (scribeState === "idle") setScribeState("modal");
          }}
          disabled={isBusy}
          className={`flex items-center gap-3 px-6 py-4 rounded-full font-bold shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            scribeState === "recording"
              ? "bg-red-500 hover:bg-red-400 text-white animate-pulse shadow-red-500/40"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
          }`}
        >
          {isBusy ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>{scribeState === "uploading" ? "Transcribing..." : "Generating note..."}</span></>
          ) : scribeState === "recording" ? (
            <><Square className="w-4 h-4 fill-current" /><span>Stop & Finalize</span></>
          ) : (
            <><Mic className="w-5 h-5" /><span>Start New Session</span></>
          )}
        </button>
      </div>
    </div>
  );
}
