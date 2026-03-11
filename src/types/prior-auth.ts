/**
 * Types for the Clinical Authorization Engine (Alberta Behavioral Health).
 * All PHI is processed server-side via Server Actions — never stored client-side.
 */

export interface StepTherapyEntry {
  /** Client-side stable key for React lists */
  id: string;
  drugOrTherapy: string;
  startDate: string | null;
  duration: string;
  reasonForFailure: string;
  supportingEvidence: string | null;
  dsmCode: string | null;
  /** True when the row was AI-generated (shows badge in UI) */
  isAiGenerated?: boolean;
}

/** Strip client-only fields before DB write */
export type StepTherapyEntryDb = Omit<StepTherapyEntry, "id" | "isAiGenerated">;

export type AlbertaPayerPreset = "abc" | "sunlife" | "ahs_special_auth";

export const ALBERTA_PAYER_CONFIG = {
  abc: {
    id: "ALBERTA_BLUE_CROSS",
    name: "Alberta Blue Cross",
    description: "Government-sponsored & employer plans. Requires AHCIP physician ID and Special Authorization form number for non-formulary drugs.",
    fields: ["ahcipPhysicianId", "specialAuthFormNumber"] as const,
  },
  sunlife: {
    id: "SUN_LIFE_FINANCIAL",
    name: "Sun Life Financial",
    description: "Employer group benefit plans. Requires group plan number and member certificate ID.",
    fields: ["groupPlanNumber", "memberCertificateId"] as const,
  },
  ahs_special_auth: {
    id: "AHS_SPECIAL_AUTH",
    name: "AHS Special Authorization",
    description: "Alberta Health Services — high-cost drugs & AISH recipients. Additional AISH documentation required when applicable.",
    fields: ["ahsProviderNumber", "specialAuthFormNumber"] as const,
  },
} as const satisfies Record<AlbertaPayerPreset, { id: string; name: string; description: string; fields: readonly string[] }>;

export interface PayerSpecificData {
  ahcipPhysicianId?: string;
  specialAuthFormNumber?: string;
  groupPlanNumber?: string;
  memberCertificateId?: string;
  ahsProviderNumber?: string;
  aishStatus?: boolean;
}

/** Patient demographics fetched server-side and passed to wizard via Server Action */
export interface EncounterContext {
  patientName: string;
  dob: string | null;
  sex: string | null;
  phn: string;
  providerName: string;
  providerCredentials: string | null;
  providerRegistrationNumber: string | null;
}

export interface ClinicalJustification {
  clinicalSummary: string;
  medicalNecessityStatement: string;
  /** ICD-10-CA codes referenced in the justification (DSM-5 mapped) */
  dsmCodes: string[];
  missingDocumentation: string[];
}

export interface EncounterForAuth {
  id: string;
  patientId: string;
  patientName: string;
  patientPhn: string;
  providerName: string;
  encounterDate: string;
  status: string;
  hasNote: boolean;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
