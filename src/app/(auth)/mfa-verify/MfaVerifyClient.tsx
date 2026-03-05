"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Props {
  mfaEnabled: boolean;
  redirectTo: string;
}

type SetupData = { qrDataUrl: string; secret: string };
type Mode = "totp" | "backup";

export function MfaVerifyClient({ mfaEnabled, redirectTo }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("totp");
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number | null>(null);

  // Setup-mode state
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [setupLoading, setSetupLoading] = useState(!mfaEnabled);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch QR code when MFA has never been configured
  useEffect(() => {
    if (mfaEnabled) {
      inputRef.current?.focus();
      return;
    }
    setSetupLoading(true);
    fetch("/api/auth/mfa/setup")
      .then((r) => r.json())
      .then((body: { data?: SetupData; error?: string }) => {
        if (body.data) {
          setSetup(body.data);
        } else {
          setError(body.error ?? "Failed to load MFA setup.");
        }
      })
      .catch(() => setError("Failed to load MFA setup."))
      .finally(() => {
        setSetupLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      });
  }, [mfaEnabled]);

  // Reset code and focus when switching modes
  useEffect(() => {
    setCode("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const isBackupMode = mode === "backup";
    const expectedLength = isBackupMode ? 8 : 6;

    if (code.length !== expectedLength) {
      setError(
        isBackupMode
          ? "Enter your 8-character backup code."
          : "Enter the 6-digit code from your authenticator app."
      );
      return;
    }

    setLoading(true);

    let endpoint: string;
    if (!mfaEnabled) {
      endpoint = "/api/auth/mfa/setup";
    } else if (isBackupMode) {
      endpoint = "/api/auth/mfa/backup-code";
    } else {
      endpoint = "/api/auth/mfa/verify";
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json()) as {
        data?: { success: boolean; remainingBackupCodes?: number };
        error?: string;
      };

      if (!res.ok || !body.data?.success) {
        setError(body.error ?? "Invalid or expired code. Try again.");
        setCode("");
        inputRef.current?.focus();
        return;
      }

      if (body.data.remainingBackupCodes !== undefined) {
        setRemainingBackupCodes(body.data.remainingBackupCodes);
        if (body.data.remainingBackupCodes === 0) {
          // Show warning briefly before redirecting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Cookie is set by the API route — navigate to the original destination.
      router.replace(redirectTo);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isSetupMode = !mfaEnabled;
  const isBackupMode = mode === "backup";
  const isDisabled = loading || setupLoading;

  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border border-white/10 bg-[#13151f] p-8 shadow-xl">
      {/* Header */}
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-white">
          {isSetupMode
            ? "Set up two-factor authentication"
            : isBackupMode
            ? "Use a backup code"
            : "Enter your verification code"}
        </h1>
        <p className="text-sm text-white/50">
          {isSetupMode
            ? "Scan the QR code with your authenticator app, then enter the 6-digit code to confirm."
            : isBackupMode
            ? "Enter one of your 8-character backup codes to verify your identity."
            : "Open your authenticator app and enter the 6-digit code for SpecScribe."}
        </p>
      </div>

      {/* QR Code (setup mode only) */}
      {isSetupMode && (
        <div className="flex flex-col items-center gap-3">
          {setupLoading ? (
            <div className="h-48 w-48 animate-pulse rounded-md bg-white/10" />
          ) : setup ? (
            <>
              <div className="rounded-md bg-white p-2">
                <Image
                  src={setup.qrDataUrl}
                  alt="Authenticator QR code"
                  width={176}
                  height={176}
                  unoptimized
                />
              </div>
              <details className="w-full text-center">
                <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
                  Can&apos;t scan? Enter key manually
                </summary>
                <p className="mt-2 break-all rounded bg-white/5 px-3 py-2 font-mono text-xs text-white/70">
                  {setup.secret}
                </p>
              </details>
            </>
          ) : null}
        </div>
      )}

      {/* Code form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="mfa-code" className="text-xs font-medium text-white/60">
            {isBackupMode ? "8-character backup code" : "6-digit code"}
          </label>
          <input
            ref={inputRef}
            id="mfa-code"
            type="text"
            inputMode={isBackupMode ? "text" : "numeric"}
            autoComplete={isBackupMode ? "off" : "one-time-code"}
            maxLength={isBackupMode ? 8 : 6}
            value={code}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().replace(/\s/g, "");
              setCode(isBackupMode ? val : val.replace(/\D/g, ""));
            }}
            placeholder={isBackupMode ? "ABCD1234" : "000000"}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-lg tracking-widest text-white placeholder-white/20 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isDisabled}
          />
        </div>

        {/* All-codes-used warning */}
        {remainingBackupCodes === 0 && (
          <p role="alert" className="rounded-md bg-amber-900/30 px-3 py-2 text-sm text-amber-400">
            All backup codes used — set up a new authenticator app or contact your administrator.
          </p>
        )}

        {/* Remaining backup codes indicator */}
        {remainingBackupCodes !== null && remainingBackupCodes > 0 && (
          <p className="text-xs text-white/40">
            {remainingBackupCodes} backup code{remainingBackupCodes === 1 ? "" : "s"} remaining
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isDisabled || code.length !== (isBackupMode ? 8 : 6)}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Verifying…"
            : isSetupMode
            ? "Confirm & activate"
            : "Verify"}
        </button>
      </form>

      {/* Backup code toggle — only shown in verify mode (not setup) */}
      {mfaEnabled && (
        <button
          type="button"
          onClick={() => setMode(isBackupMode ? "totp" : "backup")}
          className="w-full text-center text-xs text-white/40 hover:text-white/60 transition"
        >
          {isBackupMode
            ? "Use authenticator app instead"
            : "Use a backup code instead"}
        </button>
      )}
    </div>
  );
}
