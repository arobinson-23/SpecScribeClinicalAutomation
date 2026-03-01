/**
 * FHIR R4 ↔ internal model mapping.
 * Maps FHIR resources to SpecScribe internal types and vice versa.
 * Never includes PHI — callers must encrypt after mapping.
 */

import type { FHIRPatient, FHIREncounter, FHIRDocumentReference } from "./client";

// ── Patient Mapping ──────────────────────────────────────────────────────────

export interface InternalPatientData {
  fhirId: string;
  firstName: string;
  lastName: string;
  dob: string;        // YYYY-MM-DD
  sex?: string;
  phone?: string;
  email?: string;
}

export function fhirPatientToInternal(fhir: FHIRPatient): InternalPatientData {
  const officialName = fhir.name?.find((n) => n.use === "official") ?? fhir.name?.[0];
  const phone = fhir.telecom?.find((t) => t.system === "phone")?.value;
  const email = fhir.telecom?.find((t) => t.system === "email")?.value;

  return {
    fhirId: fhir.id ?? "",
    firstName: officialName?.given?.[0] ?? "",
    lastName: officialName?.family ?? "",
    dob: fhir.birthDate ?? "",
    sex: fhir.gender,
    phone,
    email,
  };
}

// ── Encounter Mapping ────────────────────────────────────────────────────────

export interface InternalEncounterData {
  fhirId: string;
  encounterDate: Date;
  status: string;
  patientFhirId: string;
  providerFhirId?: string;
}

export function fhirEncounterToInternal(fhir: FHIREncounter): InternalEncounterData {
  const patientRef = fhir.subject?.reference?.split("/").pop() ?? "";
  const providerRef = fhir.participant?.[0]?.individual?.reference?.split("/").pop();

  return {
    fhirId: fhir.id ?? "",
    encounterDate: fhir.period?.start ? new Date(fhir.period.start) : new Date(),
    status: fhir.status,
    patientFhirId: patientRef,
    providerFhirId: providerRef,
  };
}

// ── DocumentReference Builder ────────────────────────────────────────────────

export function buildDocumentReference(params: {
  patientFhirId: string;
  encounterFhirId: string;
  noteContent: string;   // plain text or HTML
  noteType: string;      // e.g. "progress_note"
  date: Date;
}): FHIRDocumentReference {
  // LOINC code for clinical note
  const LOINC_CODES: Record<string, { code: string; display: string }> = {
    progress_note:       { code: "11506-3", display: "Progress note" },
    intake:              { code: "34117-2", display: "History and physical note" },
    biopsychosocial:     { code: "67856-9", display: "Biopsychosocial assessment" },
    treatment_plan:      { code: "18776-5", display: "Plan of care note" },
    procedure:           { code: "28570-0", display: "Procedure note" },
    consultation:        { code: "11488-4", display: "Consult note" },
    discharge:           { code: "18842-5", display: "Discharge summary" },
  };

  const loinc = LOINC_CODES[params.noteType] ?? { code: "11506-3", display: "Progress note" };

  return {
    resourceType: "DocumentReference",
    status: "current",
    type: {
      coding: [
        {
          system: "http://loinc.org",
          code: loinc.code,
          display: loinc.display,
        },
      ],
    },
    subject: { reference: `Patient/${params.patientFhirId}` },
    context: {
      encounter: [{ reference: `Encounter/${params.encounterFhirId}` }],
    },
    date: params.date.toISOString(),
    content: [
      {
        attachment: {
          contentType: "text/html",
          data: Buffer.from(params.noteContent).toString("base64"),
          title: loinc.display,
        },
      },
    ],
  };
}
