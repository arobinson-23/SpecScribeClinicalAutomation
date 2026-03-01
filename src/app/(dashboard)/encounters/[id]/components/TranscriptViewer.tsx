"use client";

import type { TranscriptSegment } from "@/types/encounter";

interface TranscriptViewerProps {
  transcript: string;
  segments?: TranscriptSegment[];
}

export function TranscriptViewer({ transcript, segments }: TranscriptViewerProps) {
  if (!transcript) return null;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Transcript</h3>

      {segments && segments.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full h-fit mt-0.5 ${
                  seg.speaker === "provider"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-white/5 text-white/50"
                }`}
              >
                {seg.speaker === "provider" ? "Provider" : "Patient"}
              </span>
              <p className="text-sm text-white/70 leading-relaxed">{seg.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto border-l-2 border-white/10 pl-4">
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
    </div>
  );
}
