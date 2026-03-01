"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, Gauge, AlertCircle, Search, X, ChevronDown } from "lucide-react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { VolumeVisualizer } from "./VolumeVisualizer";
import { toast } from "sonner";

interface PatientResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
}

type ScribeState = "idle" | "modal" | "connecting" | "recording" | "generating";

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
  const { stream, startMicrophone, stopMicrophone } = useMicrophone();

  const [scribeState, setScribeState] = useState<ScribeState>("idle");
  const [transcript, setTranscript] = useState("Waiting for voice input...");
  const [confidence, setConfidence] = useState(0);

  // Pre-session modal state
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noteType, setNoteType] = useState("progress_note");
  const [noteFormat, setNoteFormat] = useState("SOAP");
  const [encounterId, setEncounterId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep transcriptRef in sync so the stop handler always has the latest value
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const cleanupAudio = useCallback(() => {
    if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
    stopMicrophone();
  }, [stopMicrophone]);

  // Typeahead patient search
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

  async function handleStartSession() {
    if (!selectedPatient) { toast.error("Select a patient before starting"); return; }

    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMrn: selectedPatient.mrn,
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
      setScribeState("connecting");
      await startDeepgramSession();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  async function startDeepgramSession() {
    try {
      setTranscript("Requesting microphone access...");
      const audioStream = await startMicrophone();
      setTranscript("Securing clinical stream via TLS 1.2+...");

      const res = await fetch("/api/deepgram");
      const { key, error } = await res.json() as { key?: string; error?: string };
      if (error || !key) throw new Error(error ?? "Failed to initialize secure connection");

      const url = "wss://api.deepgram.com/v1/listen?model=nova-2-medical&smart_format=true&interim_results=true";
      const socket = new WebSocket(url, ["token", key]);

      socket.onopen = () => {
        setTranscript("Ambient listening active. Speak clearly...");
        setScribeState("recording");

        const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
        let started = false;
        for (const mimeType of MIME_TYPES) {
          try {
            const mr = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
            mr.ondataavailable = (event) => {
              if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) socket.send(event.data);
            };
            mr.start(250);
            mediaRecorderRef.current = mr;
            started = true;
            break;
          } catch { /* try next */ }
        }
        if (!started) { toast.error("Audio recording not supported in this browser"); socket.close(); cleanupAudio(); setScribeState("idle"); }
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data as string) as {
          is_final: boolean;
          channel: { alternatives: Array<{ transcript: string; confidence: number }> };
        };
        const alt = received.channel?.alternatives[0];
        const text = alt?.transcript;
        const conf = alt?.confidence;
        if (text && received.is_final) {
          setTranscript((prev) => {
            const isPlaceholder = prev === "Ambient listening active. Speak clearly...";
            return isPlaceholder ? text : prev + " " + text;
          });
          if (conf !== undefined) setConfidence(Math.round(conf * 100));
        }
      };

      socket.onerror = () => { toast.error("Transcription stream interrupted"); cleanupAudio(); setScribeState("idle"); };
      socket.onclose = () => cleanupAudio();
      socketRef.current = socket;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Initialization failed");
      cleanupAudio();
      setScribeState("idle");
    }
  }

  async function handleStopAndFinalize() {
    const finalTranscript = transcriptRef.current;
    const currentEncounterId = encounterId;

    // Stop audio
    if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
    stopMicrophone();

    const hasContent =
      finalTranscript &&
      finalTranscript !== "Ambient listening active. Speak clearly..." &&
      finalTranscript.trim().length > 0;

    if (!currentEncounterId || !hasContent) {
      setScribeState("idle");
      setTranscript("Waiting for voice input...");
      return;
    }

    setScribeState("generating");
    setTranscript("Generating clinical note with AI...");

    try {
      const res = await fetch("/api/ai/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounterId: currentEncounterId, transcript: finalTranscript, noteType, noteFormat }),
      });

      if (!res.ok) {
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

  // Auto-cleanup on unmount
  useEffect(() => { return () => cleanupAudio(); }, [cleanupAudio]);

  const isActive = scribeState === "recording" || scribeState === "connecting";
  const isGenerating = scribeState === "generating";

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
                  placeholder="Search by name or MRN..."
                  value={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.mrn})` : patientSearch}
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
                      <span className="text-xs text-white/40 group-hover:text-white/60 font-mono">{p.mrn}</span>
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

      {/* Transcript Preview Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${scribeState === "recording" ? "bg-red-500 animate-pulse" : scribeState === "connecting" || isGenerating ? "bg-amber-500 animate-pulse" : "bg-white/20"}`} />
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest">Live Transcript Preview</h3>
            </div>
            {scribeState === "recording" && <VolumeVisualizer stream={stream} isActive />}
          </div>

          {scribeState === "recording" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Gauge className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{confidence}% Confidence</span>
            </div>
          )}
        </div>

        <div className="min-h-[140px] border-l-2 border-white/10 pl-6 py-2">
          <p className={`text-lg font-medium leading-relaxed ${isActive ? "text-white" : isGenerating ? "text-amber-400" : "text-white/30 italic"}`}>
            {transcript}
          </p>
          {(scribeState === "connecting" || isGenerating) && (
            <div className="flex items-center gap-2 mt-4 text-blue-400 text-sm animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isGenerating ? "Sending to Claude..." : "Establishing secure clinical channel..."}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span>HIA Audit Trail: Active</span>
          </div>
          <span>TLS 1.2+ Encrypted Stream</span>
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
          disabled={scribeState === "connecting" || isGenerating}
          className={`flex items-center gap-3 px-6 py-4 rounded-full font-bold shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${
            scribeState === "recording"
              ? "bg-red-500 hover:bg-red-400 text-white animate-pulse shadow-red-500/40"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
          }`}
        >
          {scribeState === "connecting" ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>Connecting...</span></>
          ) : isGenerating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>Generating note...</span></>
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
