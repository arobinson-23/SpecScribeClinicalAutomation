import { z } from "zod";

export const PracticeSettingsSchema = z.object({
  // ── AI Documentation ──────────────────────────────────────────────────────
  defaultNoteFormat:               z.enum(["SOAP", "DAP", "BIRP", "NARRATIVE"]),
  autoGenerateOnRecordingComplete: z.boolean(),
  requireProviderApproval:         z.boolean(),

  // ── Coding & Billing ──────────────────────────────────────────────────────
  autoSuggestCoding:    z.boolean(),
  minCodingConfidence:  z.enum(["low", "medium", "high"]),
  showDenialRiskScores: z.boolean(),

  // ── Transcription ─────────────────────────────────────────────────────────
  speakerDiarization: z.boolean(),

  // ── Compliance Alerts ─────────────────────────────────────────────────────
  complianceAlertThreshold: z.enum(["warning", "critical"]),
  emailOnPriorAuthDenial:   z.boolean(),

  // ── Personal Documentation Defaults ──────────────────────────────────────
  // "practice_default" defers to defaultNoteFormat above
  personalNoteFormatOverride: z.enum(["practice_default", "SOAP", "DAP", "BIRP", "NARRATIVE"]),
  autoSaveDraftSeconds:       z.enum(["30", "60", "120", "300"]),
  showWordCountInEditor:      z.boolean(),
  showTimestampsInTranscript: z.boolean(),

  // ── Security & Session ────────────────────────────────────────────────────
  // HIPAA §164.312(a)(2)(iii): automatic logoff — allowed range 5–15 minutes
  idleTimeoutMinutes: z.enum(["5", "10", "15"]),

  // ── Personal Notifications ────────────────────────────────────────────────
  emailDigestFrequency:    z.enum(["daily", "weekly", "never"]),
  notifyOnPendingReview:   z.boolean(),
  notifyOnPriorAuthUpdate: z.boolean(),
  notifyOnComplianceAlert: z.boolean(),
});

export type PracticeSettings = z.infer<typeof PracticeSettingsSchema>;

export const DEFAULT_SETTINGS: PracticeSettings = {
  // Practice-level
  defaultNoteFormat:               "SOAP",
  autoGenerateOnRecordingComplete: true,
  requireProviderApproval:         true,
  autoSuggestCoding:               true,
  minCodingConfidence:             "medium",
  showDenialRiskScores:            true,
  speakerDiarization:              true,
  complianceAlertThreshold:        "warning",
  emailOnPriorAuthDenial:          true,
  // Personal
  personalNoteFormatOverride: "practice_default",
  autoSaveDraftSeconds:       "60",
  showWordCountInEditor:      true,
  showTimestampsInTranscript: true,
  idleTimeoutMinutes:         "15",
  emailDigestFrequency:       "weekly",
  notifyOnPendingReview:      true,
  notifyOnPriorAuthUpdate:    true,
  notifyOnComplianceAlert:    true,
};
