"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink } from "lucide-react";

type VerificationStatus =
  | "verified"
  | "expired"
  | "not_in_good_standing"
  | "never_checked";

interface LatestVerification {
  id: string;
  verifiedAt: string;
  expiresAt: string;
  inGoodStanding: boolean;
  notes: string | null;
}

interface ProviderRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  credentials: string | null;
  provincialRegistrationNumber: string | null;
  province: string | null;
  registrationNumber: string | null;
  college: string | null;
  registerUrl: string;
  status: VerificationStatus;
  latestVerification: LatestVerification | null;
}

interface ActiveForm {
  userId: string;
  province: string;
  registrationNumber: string;
  inGoodStanding: "" | "true" | "false";
  notes: string;
}

const STATUS_BADGE: Record<VerificationStatus, string> = {
  verified:             "bg-green-50 text-green-700",
  expired:              "bg-amber-50 text-amber-700",
  not_in_good_standing: "bg-red-50 text-red-700",
  never_checked:        "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified:             "Verified",
  expired:              "Expired",
  not_in_good_standing: "Not in Good Standing",
  never_checked:        "Not Verified",
};

export default function ProviderVerificationSection() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/compliance/provider-verification");
      const json = await res.json() as { data?: { providers: ProviderRow[] }; error?: string };
      if (json.error) {
        setFetchError(json.error);
      } else {
        setProviders(json.data?.providers ?? []);
      }
    } catch {
      setFetchError("Failed to load verification data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchProviders(); }, [fetchProviders]);

  function openForm(p: ProviderRow) {
    setSubmitError(null);
    setActiveForm({
      userId: p.userId,
      province: p.province ?? "",
      registrationNumber: p.registrationNumber ?? "",
      inGoodStanding: p.latestVerification
        ? p.latestVerification.inGoodStanding ? "true" : "false"
        : "",
      notes: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeForm || activeForm.inGoodStanding === "") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/compliance/provider-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeForm.userId,
          province: activeForm.province.toUpperCase(),
          registrationNumber: activeForm.registrationNumber,
          inGoodStanding: activeForm.inGoodStanding === "true",
          notes: activeForm.notes || undefined,
        }),
      });
      const json = await res.json() as { error?: string };
      if (json.error) {
        setSubmitError(json.error);
      } else {
        setActiveForm(null);
        await fetchProviders();
      }
    } catch {
      setSubmitError("Submission failed — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm">Loading verification data…</div>;
  }
  if (fetchError) {
    return <div className="py-4 text-red-600 text-sm">{fetchError}</div>;
  }

  const providerUsers = providers.filter((p) => p.userId);

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Provider College Verification</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Record manual verification of each provider&apos;s good-standing status with their provincial regulatory college.
          Verifications expire after 365 days.
        </p>
      </div>

      {providerUsers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          No active providers found. Providers must have the &quot;provider&quot; role to appear here.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">College Register</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Registration #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Last Verified</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providerUsers.map((p) => (
                <>
                  <tr key={p.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {p.firstName ?? "—"} {p.lastName ?? ""}
                      </div>
                      {p.credentials && (
                        <div className="text-xs text-slate-400">{p.credentials}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.province && p.college ? (
                        <a
                          href={p.registerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs"
                        >
                          {p.province} / {p.college} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {p.registrationNumber ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {p.latestVerification
                        ? new Date(p.latestVerification.verifiedAt).toLocaleDateString("en-CA")
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => activeForm?.userId === p.userId ? setActiveForm(null) : openForm(p)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {activeForm?.userId === p.userId ? "Cancel" : "Record Verification"}
                      </button>
                    </td>
                  </tr>

                  {/* Inline form for this provider */}
                  {activeForm?.userId === p.userId && (
                    <tr key={`${p.userId}-form`}>
                      <td colSpan={6} className="px-4 py-4 bg-slate-50 border-t border-slate-100">
                        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Province</label>
                            <input
                              type="text"
                              maxLength={2}
                              placeholder="AB"
                              value={activeForm.province}
                              onChange={(e) => setActiveForm({ ...activeForm, province: e.target.value.toUpperCase() })}
                              className="w-16 border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Registration #</label>
                            <input
                              type="text"
                              placeholder="e.g. 01234"
                              value={activeForm.registrationNumber}
                              onChange={(e) => setActiveForm({ ...activeForm, registrationNumber: e.target.value })}
                              className="w-32 border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Good Standing?</label>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="radio" name={`standing-${p.userId}`} value="true"
                                  checked={activeForm.inGoodStanding === "true"}
                                  onChange={() => setActiveForm({ ...activeForm, inGoodStanding: "true" })}
                                  className="text-green-600" />
                                Yes
                              </label>
                              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="radio" name={`standing-${p.userId}`} value="false"
                                  checked={activeForm.inGoodStanding === "false"}
                                  onChange={() => setActiveForm({ ...activeForm, inGoodStanding: "false" })}
                                  className="text-red-600" />
                                No
                              </label>
                            </div>
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                            <input
                              type="text"
                              maxLength={500}
                              placeholder="e.g. Verified 2026-03-03"
                              value={activeForm.notes}
                              onChange={(e) => setActiveForm({ ...activeForm, notes: e.target.value })}
                              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            {submitError && (
                              <span className="text-xs text-red-600">{submitError}</span>
                            )}
                            <button
                              type="submit"
                              disabled={submitting || activeForm.inGoodStanding === ""}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md"
                            >
                              {submitting ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Manual verification workflow:</strong> Search each provider in their provincial college&apos;s
        public register (links above), confirm good-standing status, then record the result here.
        Verification expires after 365 days and will flag in the Compliance Dashboard.
      </div>
    </div>
  );
}
