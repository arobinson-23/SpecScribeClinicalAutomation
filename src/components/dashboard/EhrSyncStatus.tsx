"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface EhrStatus {
  connected: boolean;
  ehrType: string;
  lastSyncAt: string | null;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
}

function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "Never synced";
  const diff = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(lastSyncAt).toLocaleDateString();
}

const EHR_LABELS: Record<string, string> = {
  epic: "Epic/Hyperspace",
  meditech: "MediTech",
  accuro: "Accuro",
  none: "EHR",
};

export function EhrSyncStatus() {
  const [status, setStatus] = useState<EhrStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ehr/status");
      if (!res.ok) return;
      const json = await res.json() as { data: EhrStatus };
      setStatus(json.data);
    } catch {
      // silently fail — widget degrades gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/ehr/sync", { method: "POST" });
      const json = await res.json() as { data?: SyncResult; error?: string };
      if (!res.ok || json.error) {
        toast.error(json.error ?? "EHR sync failed");
        return;
      }
      const { created, updated, skipped } = json.data!;
      toast.success(
        `EHR sync complete — ${created} new, ${updated} updated, ${skipped} skipped`
      );
      await fetchStatus();
    } catch {
      toast.error("EHR sync failed — check your connection");
    } finally {
      setSyncing(false);
    }
  };

  const ehrLabel = EHR_LABELS[status?.ehrType ?? "none"] ?? "EHR";

  return (
    <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">EHR Sync</h3>
        {status?.connected && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">Checking connection…</span>
            <span className="w-16 h-2 bg-white/10 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">{ehrLabel}</span>
              {status?.connected ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : status?.ehrType === "none" ? (
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                  Not configured
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  Disconnected
                </span>
              )}
            </div>

            {status?.connected && (
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] text-white/30">Last sync</span>
                <span className="text-[10px] text-white/40">
                  {formatLastSync(status.lastSyncAt)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
