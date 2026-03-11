import type { AlbertaPayerPreset } from "@/types/prior-auth";

export const STEP_THERAPY_SYSTEM_PROMPT = `You are a clinical documentation specialist for SpecScribe. Your task is to analyze clinical encounter notes and extract documented evidence of prior treatment attempts for Alberta prior authorization step therapy submissions.

CONTEXT: Alberta payers (Blue Cross, AHS Special Authorization) require demonstration that first-line treatments were attempted and failed before approving second-line or specialty pharmacotherapy.

EXTRACTION RULES:
1. Extract ONLY treatments explicitly documented in the clinical notes — do not infer or assume unreported interventions.
2. Include both pharmacological (medications, dosages) and non-pharmacological (CBT, DBT, psychotherapy, lifestyle) interventions.
3. For duration, use the most specific timeframe documented (e.g., "12 weeks", "6 months", "trial period").
4. For reasons for failure, use precise clinical language from the notes (e.g., "inadequate response after therapeutic dose", "intolerable adverse effects: nausea and insomnia", "contraindicated due to hepatic impairment").
5. Include DSM-5 / ICD-10-CA codes mentioned in the notes for context.
6. Quote supporting evidence verbatim where available.

PIPEDA / HIA COMPLIANCE: Do not repeat patient names or PHNs if encountered — these should already be redacted in the input.

OUTPUT: Return a valid JSON array only. No preamble, no explanation.`;

export function buildStepTherapyPrompt(notes: string[]): string {
  const combined = notes
    .map((n, i) => `--- Clinical Note ${i + 1} ---\n${n}`)
    .join("\n\n");

  return `Extract all prior treatment attempts documented in these clinical encounter notes for Alberta prior authorization step therapy documentation.

CLINICAL NOTES:
<notes>
${combined}
</notes>

Return a JSON array with this exact structure (return [] if no prior treatments documented):
[
  {
    "drugOrTherapy": "Medication or therapy name (include dose/frequency if documented)",
    "startDate": "YYYY-MM-DD if documented, or null",
    "duration": "Duration of treatment (e.g., '12 weeks at therapeutic dose', '6 months')",
    "reasonForFailure": "Clinical reason for discontinuation or failure (e.g., 'Inadequate response after 12 weeks at 200mg/day', 'Intolerable GI side effects — nausea and vomiting')",
    "supportingEvidence": "Direct quote from notes supporting this entry, or null",
    "dsmCode": "ICD-10-CA code if mentioned (e.g., 'F33.2'), or null"
  }
]`;
}

/** Alberta-specific prior auth justification prompt */
export const ALBERTA_JUSTIFICATION_SYSTEM_PROMPT = `You are a prior authorization specialist for SpecScribe, generating clinical justifications for Alberta payers under CPSA documentation standards.

YOUR ROLE:
- Draft comprehensive medical necessity statements for Alberta behavioral health prior authorization requests.
- Address Alberta Blue Cross, Sun Life, or AHS Special Authorization criteria explicitly.
- Reference DSM-5 / ICD-10-CA diagnostic criteria with precision.
- Document functional impairments in concrete, measurable terms.
- Incorporate step therapy history as evidence of treatment-resistant presentation.

WRITING STANDARDS (CPSA / OIPC 2026):
- Use first-person clinical language ("The patient presents with...", "Clinical assessment demonstrates...")
- Reference specific functional domains: employment, relationships, self-care, safety
- Include clinical stability metrics where available (PHQ-9, GAD-7, MADRS scores if present)
- Link every requested intervention to documented clinical evidence
- Avoid vague language ("patient is struggling") — use specific, measurable terms

AISH NOTE: For AISH recipients, explicitly document how the condition prevents substantial gainful employment per the AISH program criteria.

OUTPUT: Return valid JSON only. No preamble.`;

export function buildAlbertaJustificationPrompt(params: {
  payerName: string;
  payerPreset: AlbertaPayerPreset;
  procedureCodes: string[];
  diagnosisCodes: string[];
  clinicalNote: string;
  stepTherapySummary: string;
  payerData: Record<string, unknown>;
}): string {
  const aishClause =
    params.payerPreset === "ahs_special_auth" && params.payerData["aishStatus"]
      ? "\nAISH STATUS: Patient is an AISH recipient. Document inability to maintain substantial gainful employment per AISH program criteria.\n"
      : "";

  return `Generate an Alberta prior authorization clinical justification package for a behavioral health patient.

PAYER: ${params.payerName}
PAYER TYPE: ${params.payerPreset}
REQUESTED PROCEDURE(S): ${params.procedureCodes.join(", ")}
DIAGNOSIS CODE(S): ${params.diagnosisCodes.join(", ")}
${aishClause}
STEP THERAPY HISTORY:
${params.stepTherapySummary || "No prior treatment history documented."}

CLINICAL DOCUMENTATION:
<clinical_note>
${params.clinicalNote}
</clinical_note>

REQUIRED OUTPUT SECTIONS:
1. Clinical Indication — Primary diagnosis with ICD-10-CA codes and specific DSM-5 criteria met
2. Functional Impairment — Concrete impact on employment, ADLs, relationships, and safety
3. Step Therapy Evidence — Summary of failed prior interventions with clinical rationale
4. Medical Necessity — Specific clinical need for the requested service/medication
5. Treatment Plan — Anticipated duration, measurable goals, monitoring plan
6. Provider Attestation — Statement of medical necessity per CPSA standards

Return JSON:
{
  "clinicalSummary": "string (comprehensive 3-6 sentence clinical summary addressing all payer criteria)",
  "medicalNecessityStatement": "string (formal medical necessity statement — 4-8 sentences, CPSA-standard language, address functional impairments explicitly)",
  "dsmCodes": ["ICD-10-CA code strings, e.g. F33.2"],
  "missingDocumentation": ["string — list any missing clinical elements that could cause denial"]
}`;
}
