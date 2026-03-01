"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function MFAVerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/encounters";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      toast.error(data.error ?? "Invalid verification code");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg mb-4">
            🔐
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Two-Factor Authentication</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="one-time-code"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense>
      <MFAVerifyForm />
    </Suspense>
  );
}
