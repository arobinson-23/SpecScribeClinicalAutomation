"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
    /** Pre-fetched from GET /api/ehr/status server-side */
    initialConnected: boolean;
    lastSyncAt: string | null; // ISO string or null
}

interface SyncResult {
    created: number;
    updated: number;
    skipped: number;
}

type State = "idle" | "syncing" | "success" | "error";

function timeAgo(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin === 1) return "1 min ago";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH === 1) return "1 hr ago";
    if (diffH < 24) return `${diffH} hrs ago`;
    return new Date(isoString).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function EhrSyncButton({ initialConnected, lastSyncAt }: Props) {
    const [state, setState] = useState<State>("idle");
    const [result, setResult] = useState<SyncResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [syncedAt, setSyncedAt] = useState<string | null>(lastSyncAt);

    async function handleSync() {
        setState("syncing");
        setResult(null);
        setErrorMsg(null);

        try {
            const res = await fetch("/api/ehr/sync", { method: "POST" });
            const body = await res.json() as { data?: SyncResult; error?: string };

            if (!res.ok || body.error) {
                setErrorMsg(body.error ?? `HTTP ${res.status}`);
                setState("error");
                return;
            }

            if (body.data) setResult(body.data);
            setSyncedAt(new Date().toISOString());
            setState("success");

            // Auto-reset back to idle after 6 s so the badge doesn't linger
            setTimeout(() => setState("idle"), 6_000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Network error");
            setState("error");
        }
    }

    const isConnected = initialConnected;

    return (
        <div className="flex items-center gap-3">
            {/* Connection badge */}
            <div
                className={cn(
                    "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                    isConnected
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                )}
            >
                {isConnected ? (
                    <Wifi className="h-3 w-3" />
                ) : (
                    <WifiOff className="h-3 w-3" />
                )}
                {isConnected ? "Epic connected" : "No EHR"}
            </div>

            {/* Last sync timestamp */}
            {syncedAt && (
                <span className="hidden md:block text-[11px] text-white/30 tabular-nums">
                    Synced {timeAgo(syncedAt)}
                </span>
            )}

            {/* Result summary – shown briefly after success */}
            {state === "success" && result && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium animate-in fade-in slide-in-from-right-2 duration-200">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {result.created} new · {result.updated} updated · {result.skipped} skipped
                </span>
            )}

            {state === "error" && errorMsg && (
                <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    {errorMsg}
                </span>
            )}

            {/* Sync button — only shown when Epic is connected */}
            {isConnected && (
                <button
                    id="ehr-sync-button"
                    onClick={handleSync}
                    disabled={state === "syncing"}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        state === "syncing"
                            ? "bg-blue-600/40 text-blue-300 cursor-not-allowed"
                            : "bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50"
                    )}
                >
                    <RefreshCw
                        className={cn("h-3.5 w-3.5 shrink-0", state === "syncing" && "animate-spin")}
                    />
                    {state === "syncing" ? "Syncing…" : "Sync from Epic"}
                </button>
            )}
        </div>
    );
}
