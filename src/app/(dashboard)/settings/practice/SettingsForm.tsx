"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePracticeSettings } from "./actions";
import { DEFAULT_SETTINGS } from "./settings-schema";
import type { PracticeSettings } from "./settings-schema";

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer"
      } ${checked ? "bg-blue-500" : "bg-white/10"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0 mr-6">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-white/40 mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
      <h2 className="font-semibold text-white/80 text-sm">{title}</h2>
      {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white px-3 py-1.5 focus:outline-none focus:border-blue-500/50 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0b0d17]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsForm({ initial }: { initial: PracticeSettings }) {
  const [settings, setSettings] = useState<PracticeSettings>(initial);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof PracticeSettings>(key: K, value: PracticeSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePracticeSettings(settings);
      if (result.success) {
        toast.success("Settings saved");
      } else {
        toast.error(result.error ?? "Failed to save settings");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* AI Documentation */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="AI Documentation"
          description="Controls how SpecScribe generates and processes clinical notes"
        />
        <div className="px-5">
          <Row
            label="Default note format"
            description="Applied to all new encounters unless overridden per session"
          >
            <Select
              value={settings.defaultNoteFormat}
              onChange={(v) => set("defaultNoteFormat", v as PracticeSettings["defaultNoteFormat"])}
              options={[
                { label: "SOAP", value: "SOAP" },
                { label: "DAP", value: "DAP" },
                { label: "BIRP", value: "BIRP" },
                { label: "Narrative", value: "NARRATIVE" },
              ]}
            />
          </Row>
          <Row
            label="Auto-generate note on recording complete"
            description="Immediately sends transcript to AI when recording ends"
          >
            <Toggle
              checked={settings.autoGenerateOnRecordingComplete}
              onChange={(v) => set("autoGenerateOnRecordingComplete", v)}
            />
          </Row>
          <Row
            label="Require provider approval before finalizing"
            description="AI drafts must be reviewed and approved — cannot be disabled"
          >
            <Toggle checked disabled onChange={() => {}} />
          </Row>
        </div>
      </div>

      {/* Coding & Billing */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Coding &amp; Billing"
          description="AI coding suggestions and denial prevention behavior"
        />
        <div className="px-5">
          <Row
            label="Auto-suggest CPT/ICD-10 codes after note finalization"
            description="Triggers coding engine once provider finalizes the note"
          >
            <Toggle
              checked={settings.autoSuggestCoding}
              onChange={(v) => set("autoSuggestCoding", v)}
            />
          </Row>
          <Row
            label="Minimum confidence to surface a code suggestion"
            description="Suggestions below this threshold are suppressed"
          >
            <Select
              value={settings.minCodingConfidence}
              onChange={(v) => set("minCodingConfidence", v as PracticeSettings["minCodingConfidence"])}
              options={[
                { label: "Low (≥ 40%)", value: "low" },
                { label: "Medium (≥ 65%)", value: "medium" },
                { label: "High (≥ 85%)", value: "high" },
              ]}
            />
          </Row>
          <Row
            label="Show denial risk scores on code suggestions"
            description="Displays payer-specific denial probability alongside each code"
          >
            <Toggle
              checked={settings.showDenialRiskScores}
              onChange={(v) => set("showDenialRiskScores", v)}
            />
          </Row>
        </div>
      </div>

      {/* Transcription */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Transcription"
          description="Deepgram nova-2-medical speech-to-text settings"
        />
        <div className="px-5">
          <Row
            label="Speaker diarization"
            description="Labels transcript turns as Provider or Patient — recommended for accuracy"
          >
            <Toggle
              checked={settings.speakerDiarization}
              onChange={(v) => set("speakerDiarization", v)}
            />
          </Row>
          <Row label="Transcription language" description="Additional language support coming soon">
            <Select
              value="en-US"
              onChange={() => {}}
              options={[{ label: "English (US)", value: "en-US" }]}
            />
          </Row>
        </div>
      </div>

      {/* Notifications & Compliance */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Notifications &amp; Compliance"
          description="Alert thresholds and notification preferences"
        />
        <div className="px-5">
          <Row
            label="Minimum severity for compliance alerts"
            description="Alerts below this level are logged but not surfaced in the dashboard"
          >
            <Select
              value={settings.complianceAlertThreshold}
              onChange={(v) => set("complianceAlertThreshold", v as PracticeSettings["complianceAlertThreshold"])}
              options={[
                { label: "Warning & above", value: "warning" },
                { label: "Critical only", value: "critical" },
              ]}
            />
          </Row>
          <Row
            label="Email notification on prior auth denial"
            description="Sends alert to practice admin when a PA request is denied"
          >
            <Toggle
              checked={settings.emailOnPriorAuthDenial}
              onChange={(v) => set("emailOnPriorAuthDenial", v)}
            />
          </Row>
        </div>
      </div>

      {/* Personal Documentation Defaults */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Personal Documentation Defaults"
          description="Your individual overrides — applied on top of practice-level settings"
        />
        <div className="px-5">
          <Row
            label="Note format preference"
            description="Overrides the practice default for your sessions only"
          >
            <Select
              value={settings.personalNoteFormatOverride}
              onChange={(v) => set("personalNoteFormatOverride", v as PracticeSettings["personalNoteFormatOverride"])}
              options={[
                { label: "Use practice default", value: "practice_default" },
                { label: "SOAP", value: "SOAP" },
                { label: "DAP", value: "DAP" },
                { label: "BIRP", value: "BIRP" },
                { label: "Narrative", value: "NARRATIVE" },
              ]}
            />
          </Row>
          <Row
            label="Auto-save draft interval"
            description="How often the note editor saves an in-progress draft"
          >
            <Select
              value={settings.autoSaveDraftSeconds}
              onChange={(v) => set("autoSaveDraftSeconds", v as PracticeSettings["autoSaveDraftSeconds"])}
              options={[
                { label: "Every 30 seconds", value: "30" },
                { label: "Every 1 minute", value: "60" },
                { label: "Every 2 minutes", value: "120" },
                { label: "Every 5 minutes", value: "300" },
              ]}
            />
          </Row>
          <Row
            label="Show word count in note editor"
            description="Displays a live word count below the note editor"
          >
            <Toggle
              checked={settings.showWordCountInEditor}
              onChange={(v) => set("showWordCountInEditor", v)}
            />
          </Row>
          <Row
            label="Show timestamps in transcript view"
            description="Displays per-utterance timestamps alongside the transcript"
          >
            <Toggle
              checked={settings.showTimestampsInTranscript}
              onChange={(v) => set("showTimestampsInTranscript", v)}
            />
          </Row>
        </div>
      </div>

      {/* Security & Session */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Security &amp; Session"
          description="HIPAA §164.312(a)(2)(iii) — automatic logoff after inactivity"
        />
        <div className="px-5">
          <Row
            label="Session idle timeout"
            description="You will be signed out after this period of inactivity. 15 minutes is the HIPAA-permitted maximum."
          >
            <Select
              value={settings.idleTimeoutMinutes}
              onChange={(v) => set("idleTimeoutMinutes", v as PracticeSettings["idleTimeoutMinutes"])}
              options={[
                { label: "5 minutes", value: "5" },
                { label: "10 minutes", value: "10" },
                { label: "15 minutes (max)", value: "15" },
              ]}
            />
          </Row>
        </div>
      </div>

      {/* Personal Notifications */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <SectionHeader
          title="Personal Notifications"
          description="Email and in-app alert preferences for your account"
        />
        <div className="px-5">
          <Row
            label="Email activity digest"
            description="Summary of pending reviews, coding updates, and prior auth activity"
          >
            <Select
              value={settings.emailDigestFrequency}
              onChange={(v) => set("emailDigestFrequency", v as PracticeSettings["emailDigestFrequency"])}
              options={[
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Never", value: "never" },
              ]}
            />
          </Row>
          <Row
            label="Remind me about encounters pending my review"
            description="In-app alert when a note has been generated but not yet approved"
          >
            <Toggle
              checked={settings.notifyOnPendingReview}
              onChange={(v) => set("notifyOnPendingReview", v)}
            />
          </Row>
          <Row
            label="Notify on prior authorization status changes"
            description="Alert when a PA request is approved, denied, or requires additional information"
          >
            <Toggle
              checked={settings.notifyOnPriorAuthUpdate}
              onChange={(v) => set("notifyOnPriorAuthUpdate", v)}
            />
          </Row>
          <Row
            label="Notify on new compliance alerts"
            description="In-app alert when a compliance issue is flagged for your practice"
          >
            <Toggle
              checked={settings.notifyOnComplianceAlert}
              onChange={(v) => set("notifyOnComplianceAlert", v)}
            />
          </Row>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
