"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Archive, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImportResult {
  batchId: string;
  total: number;
  imported?: number;
  duplicates?: number;
  uploaded?: number;
  noMatch?: number;
  errors: number;
  parseErrors?: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DropZone({
  accept,
  label,
  hint,
  icon: Icon,
  onFile,
  disabled,
}: {
  accept: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={!disabled ? handleDrop : undefined}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        disabled
          ? "opacity-40 cursor-not-allowed border-white/10"
          : dragging
          ? "border-blue-500/60 bg-blue-500/5"
          : "border-white/15 hover:border-white/30 hover:bg-white/[0.02]"
      }`}
    >
      <Icon className="w-8 h-8 mx-auto mb-3 text-white/30" />
      <p className="text-sm font-medium text-white/70">{label}</p>
      <p className="text-xs text-white/30 mt-1">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

function ResultBadge({ label, value, variant = "neutral" }: {
  label: string;
  value: number;
  variant?: "success" | "warn" | "error" | "neutral";
}) {
  const colors = {
    success: "text-green-400",
    warn:    "text-yellow-400",
    error:   "text-red-400",
    neutral: "text-white/60",
  };
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[variant]}`}>{value}</div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

// ── CSV Import Panel ──────────────────────────────────────────────────────────

function CsvImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/migration/import-patients", {
        method: "POST",
        body: formData,
      });
      const json = await res.json() as { data: ImportResult | null; error: string | null };

      if (!res.ok || json.error) {
        toast.error(json.error ?? "Import failed");
        return;
      }
      setResult(json.data!);
      toast.success(`Imported ${json.data!.imported ?? 0} patients`);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-400" />
        <h2 className="font-semibold text-white/80 text-sm">Import Demographics (CSV)</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="text-xs text-white/40 space-y-1">
          <p>Expected columns: <span className="font-mono text-white/60">PHN, PatientPseudoID, FirstName, LastName, DOB, Sex, Phone, Email, Address, City, Province, PostalCode</span></p>
          <p>PHN is stored as the patient MRN. All PHI fields are encrypted (AES-256-GCM) before storage.</p>
        </div>

        <DropZone
          accept=".csv"
          label={file ? file.name : "Drop Demographics.csv here or click to browse"}
          hint="CSV format, Alberta EMR export"
          icon={FileText}
          onFile={setFile}
          disabled={loading}
        />

        {file && (
          <div className="flex items-center justify-between text-xs text-white/50 bg-white/[0.03] rounded-lg px-3 py-2">
            <span>{file.name}</span>
            <span>{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
          ) : (
            <><Upload className="w-4 h-4" /> Import Patients</>
          )}
        </button>

        {result && (
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-white/80">Import complete</span>
              <span className="text-xs text-white/30 font-mono ml-auto">{result.batchId.slice(0, 8)}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <ResultBadge label="Total rows" value={result.total} />
              <ResultBadge label="Imported" value={result.imported ?? 0} variant="success" />
              <ResultBadge label="Duplicates" value={result.duplicates ?? 0} variant="warn" />
              <ResultBadge label="Errors" value={result.errors} variant={result.errors > 0 ? "error" : "neutral"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ZIP Import Panel ──────────────────────────────────────────────────────────

function ZipImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/migration/import-notes", {
        method: "POST",
        body: formData,
      });
      const json = await res.json() as { data: ImportResult | null; error: string | null };

      if (!res.ok || json.error) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      setResult(json.data!);
      toast.success(`Uploaded ${json.data!.uploaded ?? 0} clinical notes`);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
        <Archive className="w-4 h-4 text-purple-400" />
        <h2 className="font-semibold text-white/80 text-sm">Import Clinical Notes (ZIP)</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="text-xs text-white/40 space-y-1">
          <p>ZIP must contain PDFs named <span className="font-mono text-white/60">Firstname_Lastname.pdf</span>. Files are matched to existing patients by name.</p>
          <p>PDF metadata (author, creator, timestamps) is stripped before upload. Files are stored in private S3 with AES-256 encryption.</p>
        </div>

        <DropZone
          accept=".zip"
          label={file ? file.name : "Drop clinical notes ZIP here or click to browse"}
          hint="ZIP archive of patient PDFs"
          icon={Archive}
          onFile={setFile}
          disabled={loading}
        />

        {file && (
          <div className="flex items-center justify-between text-xs text-white/50 bg-white/[0.03] rounded-lg px-3 py-2">
            <span>{file.name}</span>
            <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><Upload className="w-4 h-4" /> Upload & Strip Metadata</>
          )}
        </button>

        {result && (
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              {result.errors > 0 || (result.noMatch ?? 0) > 0
                ? <AlertCircle className="w-4 h-4 text-yellow-400" />
                : <CheckCircle className="w-4 h-4 text-green-400" />
              }
              <span className="text-sm font-medium text-white/80">Upload complete</span>
              <span className="text-xs text-white/30 font-mono ml-auto">{result.batchId.slice(0, 8)}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <ResultBadge label="Total PDFs" value={result.total} />
              <ResultBadge label="Uploaded" value={result.uploaded ?? 0} variant="success" />
              <ResultBadge label="No match" value={result.noMatch ?? 0} variant="warn" />
              <ResultBadge label="Errors" value={result.errors} variant={result.errors > 0 ? "error" : "neutral"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MigrationUpload() {
  return (
    <div className="space-y-4">
      <CsvImportPanel />
      <ZipImportPanel />
    </div>
  );
}
