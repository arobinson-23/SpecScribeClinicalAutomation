"use client";

import { useState, useRef, useCallback } from "react";

type RecordingState = "idle" | "recording" | "paused";

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(250);
    setState("recording");
    setDuration(0);
    setAudioBlob(null);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      if (timerRef.current) clearInterval(timerRef.current);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setState("idle");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    setState("recording");
  }, []);

  return { state, duration, audioBlob, start, stop, pause, resume };
}
