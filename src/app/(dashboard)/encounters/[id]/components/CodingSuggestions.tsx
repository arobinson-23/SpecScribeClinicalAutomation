"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { SuggestCodesOutput, CodeSuggestion } from "@/types/encounter";

interface CodingSuggestionsProps {
  encounterId: string;
  noteId: string;
  payerName?: string;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-emerald-400 bg-emerald-500/10"
      : pct >= 50
      ? "text-amber-400 bg-amber-500/10"
      : "text-red-400 bg-red-500/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {pct}% confidence
    </span>
  );
}

export function CodingSuggestions({ encounterId, noteId, payerName }: CodingSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestCodesOutput | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const runCodingSuggestion = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ai/suggest-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encounterId, noteId, payerName }),
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Code suggestion failed. Please try again.");
      return;
    }

    const data = await res.json() as { data?: SuggestCodesOutput };
    if (data.data) {
      setResult(data.data);
      setAccepted(new Set());
      setRejected(new Set());
    }
  }, [encounterId, noteId, payerName]);

  async function acceptCode(code: CodeSuggestion) {
    await fetch(`/api/encounters/${encounterId}/codes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.code, accepted: true }),
    });
    setAccepted((prev) => new Set([...prev, code.code]));
    setRejected((prev) => { const s = new Set(prev); s.delete(code.code); return s; });
  }

  async function rejectCode(code: CodeSuggestion) {
    await fetch(`/api/encounters/${encounterId}/codes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.code, accepted: false }),
    });
    setRejected((prev) => new Set([...prev, code.code]));
    setAccepted((prev) => { const s = new Set(prev); s.delete(code.code); return s; });
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">AI Coding Suggestions</h3>
        <button
          onClick={runCodingSuggestion}
          disabled={loading}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analyzing note..." : "Suggest codes"}
        </button>
      </div>

      {result ? (
        <div className="p-5 space-y-4">
          {/* Rejection risk flags */}
          {result.rejectionRiskFlags.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Submission Risk Flags
              </div>
              <ul className="space-y-0.5">
                {result.rejectionRiskFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-orange-400/80">{flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AHCIP visit level */}
          {result.visitLevel && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-400 mb-0.5">Visit Level: {result.visitLevel}</div>
              {result.visitJustification && (
                <p className="text-xs text-blue-400/70">{result.visitJustification}</p>
              )}
            </div>
          )}

          {/* Code suggestions */}
          <div className="space-y-2">
            {result.suggestions.map((s) => {
              const isAccepted = accepted.has(s.code);
              const isRejected = rejected.has(s.code);
              return (
                <div
                  key={`${s.code}-${s.modifier}`}
                  className={`border rounded-xl p-3 transition-colors ${
                    isAccepted
                      ? "border-emerald-500/20 bg-emerald-500/[0.07]"
                      : isRejected
                      ? "border-white/5 bg-white/[0.02] opacity-40"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-white">
                          {s.code}{s.modifier ? `-${s.modifier}` : ""}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50">{s.codeType}</span>
                        {s.units > 1 && <span className="text-xs text-white/40">× {s.units}</span>}
                        <ConfidenceBadge score={s.confidence} />
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{s.description}</p>
                      <p className="text-xs text-white/30 mt-1 italic">{s.rationale}</p>
                    </div>
                    {!isRejected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => acceptCode(s)}
                          disabled={isAccepted}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isAccepted
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400"
                          }`}
                          title="Accept code"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rejectCode(s)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
                          title="Reject code"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-white/25">
            Generated in {(result.latencyMs / 1000).toFixed(1)}s using {result.modelVersion} • {result.inputTokens + result.outputTokens} tokens
          </p>
        </div>
      ) : (
        <div className="p-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-white/10" />
          <p className="text-sm text-white/30">Finalize the note above, then click &quot;Suggest codes&quot;</p>
        </div>
      )}
    </div>
  );
}
