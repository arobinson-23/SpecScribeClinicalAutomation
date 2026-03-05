"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AudioRecorderProps {
  encounterId: string;
  onTranscriptReady: (transcript: string, segments: unknown[]) => void;
}

type RecordingState = "idle" | "recording" | "processing";

export function AudioRecorder({ encounterId, onTranscriptReady }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone access to record.");
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    setState("processing");

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    await transcribeBlob(blob);
  }, []);

  async function transcribeBlob(blob: Blob) {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("encounterId", encounterId);

    const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      toast.error("Transcription failed. Please try again.");
      setState("idle");
      return;
    }

    const data = await res.json() as { data?: { transcript: string; segments: unknown[] } };
    if (data.data) {
      onTranscriptReady(data.data.transcript, data.data.segments);
      toast.success("Transcription complete");
    }
    setState("idle");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("processing");
    const form = new FormData();
    form.append("audio", file);
    form.append("encounterId", encounterId);

    const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      toast.error("Transcription failed. Please try again.");
      setState("idle");
      return;
    }

    const data = await res.json() as { data?: { transcript: string; segments: unknown[] } };
    if (data.data) {
      onTranscriptReady(data.data.transcript, data.data.segments);
      toast.success("Transcription complete");
    }
    setState("idle");
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Audio Recording</h3>

      <div className="flex items-center gap-3">
        {state === "idle" && (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              <Mic className="h-4 w-4" />
              Start recording
            </button>
            <label className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors text-white/60 hover:text-white">
              <Upload className="h-4 w-4" />
              Upload audio
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </>
        )}

        {state === "recording" && (
          <>
            <div className="flex items-center gap-2 text-red-400">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-sm font-bold">{formatDuration(duration)}</span>
            </div>
            <button
              onClick={stopAndTranscribe}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop &amp; transcribe
            </button>
          </>
        )}

        {state === "processing" && (
          <div className="flex items-center gap-2 text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Transcribing with AWS Medical AI...</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/25 mt-4">
        Audio is encrypted and processed with zero data retention. Speaker diarization separates provider and patient voices.
      </p>
    </div>
  );
}
