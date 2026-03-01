"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2, X } from "lucide-react";

interface PatientResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
}

type SubmitStep = "idle" | "creating" | "generating";

export default function NewEncounterPage() {
  const router = useRouter();
  const [step, setStep] = useState<SubmitStep>("idle");
  const [error, setError] = useState("");

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (patientSearch.length < 2) { setPatientResults([]); return; }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=8`);
        if (res.ok) {
          const { data } = await res.json() as { data: { items: PatientResult[] } };
          setPatientResults(data?.items ?? []);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [patientSearch]);

  const loading = step !== "idle";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!selectedPatient) {
      setError("Please select a patient before submitting.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const patientMrn = selectedPatient.mrn;
    const encounterDate = form.get("encounterDate") as string;
    const specialtyType = form.get("specialtyType") as string;
    const noteType = form.get("noteType") as string;
    const noteFormat = form.get("noteFormat") as string;
    const sessionNotes = form.get("sessionNotes") as string;

    try {
      // Step 1: Create the encounter record
      setStep("creating");
      const encounterRes = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientMrn, encounterDate, specialtyType, noteType, noteFormat }),
      });

      if (!encounterRes.ok) {
        const data = await encounterRes.json();
        setError(data.error ?? "Failed to create encounter");
        setStep("idle");
        return;
      }

      const { data: encounterData } = await encounterRes.json();

      // Step 2: Generate AI clinical note from the typed session notes
      setStep("generating");
      const noteRes = await fetch("/api/ai/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: encounterData.id,
          transcript: sessionNotes,
          noteType,
          noteFormat,
        }),
      });

      if (!noteRes.ok) {
        const data = await noteRes.json();
        setError(data.error ?? "Note generation failed. You can still review the encounter.");
        router.push(`/encounters/${encounterData.id}`);
        return;
      }

      router.push(`/encounters/${encounterData.id}`);
    } catch {
      setError("Network error. Please try again.");
      setStep("idle");
    }
  }

  const inputClass = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-colors";
  const labelClass = "block text-xs font-bold text-white/50 uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen bg-[#0b0d17] text-white">
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/encounters" className="text-xs font-bold text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors mb-4 inline-block">
            ← Back to encounters
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-black text-blue-400 uppercase tracking-widest">
              Manual Entry
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">New Encounter</h1>
          <p className="text-white/40 text-sm mt-1">Missed the recording? Enter your session notes and the AI will generate a structured clinical note.</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Patient search */}
            <div>
              <label className={labelClass}>Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                {selectedPatient ? (
                  <div className="w-full pl-8 pr-8 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-white flex items-center">
                    <span className="flex-1">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                      <span className="ml-2 text-xs font-mono text-white/40">{selectedPatient.mrn}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedPatient(null); setPatientSearch(""); setPatientResults([]); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Search by name or MRN…"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className={`${inputClass} pl-8 pr-8`}
                    autoComplete="off"
                  />
                )}
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin" />
                )}
              </div>

              {patientResults.length > 0 && !selectedPatient && (
                <div className="mt-1 bg-[#0f1120] border border-white/10 rounded-lg overflow-hidden shadow-xl z-10 relative">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch(""); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between border-b border-white/5 last:border-0"
                    >
                      <span className="text-sm text-white">{p.firstName} {p.lastName}</span>
                      <span className="text-xs font-mono text-white/40">{p.mrn}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-white/25 mt-1.5">Type at least 2 characters to search registered patients</p>
            </div>

            {/* Encounter date */}
            <div>
              <label htmlFor="encounterDate" className={labelClass}>Encounter Date &amp; Time</label>
              <input
                id="encounterDate"
                name="encounterDate"
                type="datetime-local"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
                className={inputClass}
              />
            </div>

            {/* Specialty */}
            <div>
              <label htmlFor="specialtyType" className={labelClass}>Specialty</label>
              <select
                id="specialtyType"
                name="specialtyType"
                required
                defaultValue="behavioral_health"
                className={`${inputClass} appearance-none`}
              >
                <option value="behavioral_health" className="bg-[#0f1120]">Behavioral Health</option>
                <option value="dermatology" className="bg-[#0f1120]">Dermatology</option>
                <option value="orthopedics" className="bg-[#0f1120]">Orthopedics</option>
                <option value="pain_management" className="bg-[#0f1120]">Pain Management</option>
                <option value="oncology" className="bg-[#0f1120]">Oncology</option>
              </select>
            </div>

            {/* Note type + format */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="noteType" className={labelClass}>Note Type</label>
                <select
                  id="noteType"
                  name="noteType"
                  required
                  defaultValue="progress_note"
                  className={`${inputClass} appearance-none`}
                >
                  <option value="progress_note" className="bg-[#0f1120]">Progress Note</option>
                  <option value="intake" className="bg-[#0f1120]">Intake / Initial Evaluation</option>
                  <option value="biopsychosocial" className="bg-[#0f1120]">Biopsychosocial Assessment</option>
                  <option value="treatment_plan" className="bg-[#0f1120]">Treatment Plan</option>
                  <option value="procedure" className="bg-[#0f1120]">Procedure Note</option>
                  <option value="consultation" className="bg-[#0f1120]">Consultation</option>
                  <option value="discharge" className="bg-[#0f1120]">Discharge Summary</option>
                </select>
              </div>
              <div>
                <label htmlFor="noteFormat" className={labelClass}>Format</label>
                <select
                  id="noteFormat"
                  name="noteFormat"
                  required
                  defaultValue="SOAP"
                  className={`${inputClass} appearance-none`}
                >
                  <option value="SOAP" className="bg-[#0f1120]">SOAP</option>
                  <option value="DAP" className="bg-[#0f1120]">DAP</option>
                  <option value="BIRP" className="bg-[#0f1120]">BIRP</option>
                  <option value="NARRATIVE" className="bg-[#0f1120]">Narrative</option>
                </select>
              </div>
            </div>

            {/* Session notes */}
            <div>
              <label htmlFor="sessionNotes" className={labelClass}>Session Notes</label>
              <textarea
                id="sessionNotes"
                name="sessionNotes"
                required
                minLength={10}
                rows={8}
                placeholder="Describe what happened during the session — patient presentation, interventions, response to treatment, plan, any relevant observations. The AI will use this to generate a structured clinical note."
                className={`${inputClass} resize-y`}
              />
              <p className="text-[11px] text-white/25 mt-1.5">
                Enter your raw notes from the session. The AI will structure them into the selected note type and format.
              </p>
            </div>

            {/* Info banner */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                <strong>Forgot to record?</strong> Enter your session notes above and the AI will generate a
                structured clinical note ready for your review — the same output as the live recording flow.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                {step === "creating" && "Creating encounter…"}
                {step === "generating" && "Generating clinical note…"}
                {step === "idle" && "Generate Note"}
              </button>
              <Link
                href="/encounters"
                className="px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
