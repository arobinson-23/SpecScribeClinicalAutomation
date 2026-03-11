"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles, Check, X, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SuggestCodesOutput, CodeSuggestion } from "@/types/encounter";

interface CodingSuggestionsProps {
  encounterId: string;
  noteId: string;
  payerName?: string;
  autoGenerate?: boolean;
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

export function CodingSuggestions({ encounterId, noteId, payerName, autoGenerate = false }: CodingSuggestionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestCodesOutput | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [hasRunAuto, setHasRunAuto] = useState(false);
  const [generatingAuth, setGeneratingAuth] = useState(false);

  const runCodingSuggestion = useCallback(async () => {
    if (loading) return;
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
  }, [encounterId, noteId, payerName, loading]);

  useEffect(() => {
    if (autoGenerate && !hasRunAuto && !result && !loading) {
      setHasRunAuto(true);
      runCodingSuggestion();
    }
  }, [autoGenerate, hasRunAuto, result, loading, runCodingSuggestion]);

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

  async function handleGeneratePriorAuth() {
    if (accepted.size === 0) {
      toast.error("Please accept at least one billing code first.");
      return;
    }

    setGeneratingAuth(true);
    const acceptedList = Array.from(accepted);

    // For demo: pass all accepted codes to both arrays, API/backend AI logic handles clinical applicability natively
    try {
      const res = await fetch("/api/ai/prior-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId,
          payerName: payerName || "Alberta Blue Cross",
          procedureCodes: acceptedList,
          diagnosisCodes: acceptedList,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to generate prior authorization.");
        setGeneratingAuth(false);
        return;
      }

      toast.success("Prior Authorization generated successfully!");
      router.push("/prior-auth");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate prior authorization");
    } finally {
      setGeneratingAuth(false);
    }
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
              <div className="space-y-2 mt-3">
                {[...result.rejectionRiskFlags]
                  .sort((a, b) => {
                    const order: Record<string, number> = { CRITICAL: 1, HIGH: 2, MODERATE: 3, LOW: 4 };
                    const getLevel = (s: string) => s.split(" ")[0] || "";
                    const diff = (order[getLevel(a)] || 99) - (order[getLevel(b)] || 99);
                    return diff !== 0 ? diff : a.localeCompare(b);
                  })
                  .map((flag, i) => {
                    // Try to parse format: "LEVEL - TITLE: Description"
                    const match = flag.match(/^(CRITICAL|HIGH|MODERATE|LOW)\s*(?:—|-)\s*([^:]+):\s*(.*)$/i);
                    const fallbackLevel = flag.split(" ")[0] || "";
                    const level = match?.[1] ? match[1].toUpperCase() : fallbackLevel.toUpperCase() || "UNKNOWN";
                    const title = match?.[2] || "";
                    const desc = match?.[3] || flag;

                    let bg = "bg-slate-500/10";
                    let text = "text-slate-400";
                    let border = "border-slate-500/20";

                    if (level === "CRITICAL") {
                      bg = "bg-red-500/10"; text = "text-red-400"; border = "border-red-500/20";
                    } else if (level === "HIGH") {
                      bg = "bg-orange-500/10"; text = "text-orange-400"; border = "border-orange-500/20";
                    } else if (level === "MODERATE") {
                      bg = "bg-amber-500/10"; text = "text-amber-400"; border = "border-amber-500/20";
                    } else if (level === "LOW") {
                      bg = "bg-blue-500/10"; text = "text-blue-400"; border = "border-blue-500/20";
                    }

                    return (
                      <div key={i} className={`p-3 rounded-lg border ${border} ${bg} flex gap-3 items-start`}>
                        <div className={`mt-0.5 text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase border shrink-0 ${border} ${text}`}>
                          {level}
                        </div>
                        <div className="flex-1 min-w-0">
                          {title && <div className={`font-bold text-xs mb-1 ${text}`}>{title}</div>}
                          <div className={`text-xs opacity-80 ${text}`}>{desc}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
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
                  className={`border rounded-xl p-3 transition-colors ${isAccepted
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
                          className={`p-1.5 rounded-lg transition-colors ${isAccepted
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

          <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-6">
            <p className="text-[11px] text-white/25">
              Generated in {(result.latencyMs / 1000).toFixed(1)}s using {result.modelVersion} • {result.inputTokens + result.outputTokens} tokens
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePriorAuth}
                disabled={generatingAuth || accepted.size === 0}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors"
                title={accepted.size === 0 ? "Accept at least one code to generate" : ""}
              >
                {generatingAuth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {generatingAuth ? "Drafting..." : "Generate Prior Auth"}
              </button>
              <button
                onClick={async () => {
                  if (accepted.size === 0) {
                    toast.error("Please accept at least one code before finishing.");
                    return;
                  }
                  try {
                    await fetch(`/api/encounters/${encounterId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "finalized" })
                    });
                    toast.success("Encounter successfully saved and locked.");
                    router.push("/encounters");
                  } catch (e) {
                    toast.error("Failed to commit final encounter status.");
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Save Codes & Finish File
              </button>
            </div>
          </div>
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
