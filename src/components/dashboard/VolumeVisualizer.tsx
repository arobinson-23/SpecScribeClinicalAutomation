"use client";

import { useEffect, useRef } from "react";

interface VolumeVisualizerProps {
    stream: MediaStream | null;
    isActive: boolean;
}

export function VolumeVisualizer({ stream, isActive }: VolumeVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const analyzerRef = useRef<AnalyserNode>();

    useEffect(() => {
        if (!isActive || !stream || !canvasRef.current) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzerRef.current = analyzer;

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d")!;

        function draw() {
            if (!isActive || !canvasRef.current) return;
            const currentCanvas = canvasRef.current;
            const currentCtx = currentCanvas.getContext("2d");
            if (!currentCtx) return;

            animationRef.current = requestAnimationFrame(draw);
            analyzer.getByteFrequencyData(dataArray);

            currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

            const barWidth = (currentCanvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = ((dataArray[i] ?? 0) / 255) * currentCanvas.height;

                // Gradient styling
                const gradient = currentCtx.createLinearGradient(0, currentCanvas.height, 0, 0);
                gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)"); // Blue
                gradient.addColorStop(1, "rgba(59, 130, 246, 1)");   // Solid Blue

                currentCtx.fillStyle = gradient;
                currentCtx.fillRect(x, currentCanvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        }

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioContext.state !== "closed") audioContext.close();
        };
    }, [stream, isActive]);

    return (
        <canvas
            ref={canvasRef}
            width={120}
            height={32}
            className="rounded bg-black/20"
        />
    );
}
