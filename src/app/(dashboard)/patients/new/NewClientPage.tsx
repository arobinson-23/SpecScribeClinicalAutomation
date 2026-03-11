"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  DatabaseBackup,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { MigrationUpload } from "@/app/(dashboard)/admin/migration/MigrationUpload";

type Mode = "manual" | "migrate";

interface NewClientPageProps {
  canMigrate: boolean;
}

// ── Field helper ──────────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60";

const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

// ── Manual entry form ─────────────────────────────────────────────────────────

function ManualEntryForm({ onSuccess }: { onSuccess: (id: string) => void }) {
  const [form, setForm] = useState({
    phn: "",
    firstName: "",
    lastName: "",
    dob: "",
    sex: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phn: form.phn,
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          sex: form.sex || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
        }),
      });

      const json = (await res.json()) as {
        data: { id: string; phn: string } | null;
        error: string | null;
      };

      if (!res.ok || json.error) {
        toast.error(json.error ?? "Failed to create client");
        return;
      }

      toast.success("Client added successfully");
      onSuccess(json.data!.id);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-5"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className={inputClass}
            placeholder="Jane"
            value={form.firstName}
            onChange={set("firstName")}
          />
        </div>
        <div>
          <label className={labelClass}>
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className={inputClass}
            placeholder="Doe"
            value={form.lastName}
            onChange={set("lastName")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            PHN (Personal Health Number) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className={`${inputClass} font-mono`}
            placeholder="9876100001"
            value={form.phn}
            onChange={set("phn")}
          />
        </div>
        <div>
          <label className={labelClass}>
            Date of Birth <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            required
            className={inputClass}
            value={form.dob}
            onChange={set("dob")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Sex</label>
          <select
            className={inputClass}
            value={form.sex}
            onChange={set("sex")}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown / prefer not to say</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            className={inputClass}
            placeholder="(780) 555-0123"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          className={inputClass}
          placeholder="jane.doe@example.com"
          value={form.email}
          onChange={set("email")}
        />
      </div>

      <div className="pt-2 flex items-center justify-end gap-3">
        <Link
          href="/patients"
          className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Adding…
            </>
          ) : (
            "Add Client"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Migration section ─────────────────────────────────────────────────────────

function MigrationSection() {
  return (
    <div className="space-y-4">
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white/80">Bulk legacy data migration</p>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            Upload a demographics CSV to create all client records at once, then attach
            historical clinical notes by uploading a ZIP of PDFs named{" "}
            <span className="font-mono text-white/70">Firstname_Lastname.pdf</span>.
            Every import is encrypted (AES-256-GCM) and logged to the HIA-compliant
            audit trail.
          </p>
        </div>
      </div>
      <MigrationUpload />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NewClientPage({ canMigrate }: NewClientPageProps) {
  const [mode, setMode] = useState<Mode>("manual");
  const router = useRouter();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/patients"
          className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Client</h1>
          <p className="text-white/50 text-sm mt-0.5">
            {canMigrate
              ? "Enter details manually or migrate all legacy data at once"
              : "Enter client details manually"}
          </p>
        </div>
      </div>

      {/* Mode switcher — only shown to admins */}
      {canMigrate && (
        <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              mode === "manual"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            onClick={() => setMode("migrate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              mode === "migrate"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <DatabaseBackup className="w-4 h-4" />
            Migrate Legacy Data
          </button>
        </div>
      )}

      {canMigrate && mode === "migrate" ? (
        <MigrationSection />
      ) : (
        <ManualEntryForm onSuccess={(id) => router.push(`/patients/${id}`)} />
      )}
    </div>
  );
}
