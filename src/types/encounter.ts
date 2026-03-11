import type {
  Encounter,
  EncounterNote,
  EncounterCode,
  EncounterStatus,
  NoteType,
  NoteFormat,
  CodeType,
} from "@prisma/client";

export type EncounterWithRelations = Encounter & {
  notes: EncounterNote[];
  codes: EncounterCode[];
  patient: { firstName: string; lastName: string; phn: string };
  provider: { firstName: string; lastName: string; credentials: string | null };
};

export interface CreateEncounterInput {
  patientId: string;
  encounterDate: string; // ISO date
  noteType: NoteType;
  noteFormat: NoteFormat;
}

export interface GenerateNoteInput {
  encounterId: string;
  transcript: string;
  noteType: NoteType;
  noteFormat: NoteFormat;
  clinicName?: string;
  patientName?: string;
  providerName?: string;
  encounterDate?: string;
  sessionDurationMinutes?: number;
  patientContext?: {
    ageYears?: number;
    biologicalSex?: string;
    priorDiagnoses?: string[];
    currentMedications?: string[];
    chiefComplaint?: string;
    historicalContext?: string;
  };
}

export interface GenerateNoteOutput {
  note: string;
  wordCount: number;
  modelVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface CodeSuggestion {
  codeType: CodeType;
  code: string;
  description: string;
  modifier?: string;
  units: number;
  confidence: number; // 0.0–1.0
  rationale: string;
}

export interface SuggestCodesOutput {
  suggestions: CodeSuggestion[];
  visitLevel?: string;         // AHCIP visit complexity (e.g. "Comprehensive — 03.04A")
  visitJustification?: string;
  rejectionRiskFlags: string[];
  modelVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface TranscriptSegment {
  speaker: "provider" | "patient" | "unknown";
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}
