"use client";

import { useState, useCallback, useRef } from "react";

export function useMicrophone() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isAccessGranted, setIsAccessGranted] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const startMicrophone = useCallback(async () => {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setStream(audioStream);
            setIsAccessGranted(true);
            setError(null);
            return audioStream;
        } catch (err) {
            console.error("Microphone access error:", err);
            setError(err instanceof Error ? err : new Error("Could not access microphone"));
            setIsAccessGranted(false);
            throw err;
        }
    }, []);

    const stopMicrophone = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setIsAccessGranted(false);
        }
    }, [stream]);

    return {
        stream,
        error,
        isAccessGranted,
        startMicrophone,
        stopMicrophone,
    };
}
