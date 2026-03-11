// Form template configurations, keyword detection, and data match scoring for Smart PDF Recommender

export type FormId = 'abc_60015' | 'ds2444b' | 'aps_490s';

export const FORM_IDS: FormId[] = ['abc_60015', 'ds2444b', 'aps_490s'];

export interface FormConfig {
  id: FormId;
  label: string;
  shortLabel: string;
  description: string;
  /** Path relative to /public — loaded at runtime; falls back to programmatic generation if absent */
  pdfTemplatePath: string;
  /** Patterns to scan in clinical notes for auto-recommendation */
  keywords: RegExp[];
  /**
   * AcroForm field names used when a real PDF template is loaded.
   * The 'signature' field is intentionally excluded from read-only locking.
   */
  formFields: {
    patientFirstName?: string;
    patientLastName?: string;
    patientName?: string;
    dob?: string;
    phn?: string;
    procedureCode?: string;
    diagnosisCode?: string;
    clinicalIndication?: string;
    medicalNecessity?: string;
    stepTherapy?: string;
    prescriber?: string;
    prescriberReg?: string;
    date?: string;
    signature?: string; // kept editable — not set to read-only
  };
}

export const FORM_CONFIGS: Record<FormId, FormConfig> = {
  abc_60015: {
    id: 'abc_60015',
    label: 'Alberta Blue Cross Special Authorization (ABC 60015)',
    shortLabel: 'ABC 60015',
    description:
      'Required for ABC-covered medications and procedures needing special authorization under AHCIP.',
    pdfTemplatePath: '/pdf-templates/abc-60015.pdf',
    keywords: [/\babc\b/i, /alberta blue cross/i, /blue cross/i, /special auth/i],
    formFields: {
      patientFirstName: 'f-PatientFirstName',
      patientLastName: 'f-PatientLastName',
      dob: 'f-DateOfBirth',
      phn: 'f-AHCIPNumber',
      procedureCode: 'f-RequestedItem',
      diagnosisCode: 'f-DiagnosisCode',
      clinicalIndication: 'f-ClinicalIndication',
      medicalNecessity: 'f-MedicalNecessity',
      stepTherapy: 'f-PreviousTherapies',
      prescriber: 'f-PrescriberName',
      prescriberReg: 'f-PrescriberRegistration',
      date: 'f-SubmissionDate',
      signature: 'f-PhysicianSignature',
    },
  },
  ds2444b: {
    id: 'ds2444b',
    label: 'AISH Medical Report (DS2444b)',
    shortLabel: 'DS2444b',
    description:
      'Required for Assured Income for the Severely Handicapped (AISH) program applications in Alberta.',
    pdfTemplatePath: '/pdf-templates/ds2444b.pdf',
    keywords: [
      /\baish\b/i,
      /assured income/i,
      /severely handicapped/i,
      /disability support/i,
      /aish program/i,
    ],
    formFields: {
      patientFirstName: 'f-ApplicantFirstName',
      patientLastName: 'f-ApplicantLastName',
      dob: 'f-DateOfBirth',
      phn: 'f-PHN',
      diagnosisCode: 'f-PrimaryDiagnosis',
      clinicalIndication: 'f-PresentingCondition',
      medicalNecessity: 'f-Prognosis',
      stepTherapy: 'f-TreatmentHistory',
      prescriber: 'f-PhysicianName',
      prescriberReg: 'f-CPSARegistration',
      date: 'f-ReportDate',
      signature: 'f-PhysicianSignature',
    },
  },
  aps_490s: {
    id: 'aps_490s',
    label: 'Sun Life Attending Physician Statement (APS-490S)',
    shortLabel: 'APS-490S',
    description:
      'Required for Sun Life group benefits disability and drug coverage reimbursement claims.',
    pdfTemplatePath: '/pdf-templates/aps-490s.pdf',
    keywords: [/sun life/i, /sunlife/i, /aps.490/i, /group benefit/i, /sun life financial/i],
    formFields: {
      patientFirstName: 'f-PatientFirstName',
      patientLastName: 'f-PatientLastName',
      dob: 'f-PatientDOB',
      phn: 'f-PolicyNumber',
      diagnosisCode: 'f-PrimaryDiagnosis',
      clinicalIndication: 'f-SymptomsHistory',
      medicalNecessity: 'f-TreatmentPlan',
      stepTherapy: 'f-PreviousTreatments',
      prescriber: 'f-AttendingPhysician',
      prescriberReg: 'f-LicenseNumber',
      date: 'f-StatementDate',
      signature: 'f-PhysicianSignature',
    },
  },
};

// ── Data types ─────────────────────────────────────────────────────────────────

export interface PdfFormData {
  patientName: string;
  clinicalSummary: string | null;
  medicalNecessityStatement: string | null;
  procedureCodes: string[];
  diagnosisCodes: string[];
  dsmCodes: string[];
  stepTherapy: Array<{
    drugOrTherapy: string;
    duration: string;
    reasonForFailure: string;
    startDate?: string | null;
    supportingEvidence?: string;
    dsmCode?: string;
  }>;
  payerPreset: string | null;
  payerName: string;
  submissionDate: string; // ISO date string (yyyy-MM-dd)
}

// ── Keyword detection ──────────────────────────────────────────────────────────

/**
 * Scans clinical text for payer-specific keywords and returns the most likely form.
 * The `payerPreset` (from the wizard) takes priority over keyword scanning.
 */
export function detectRecommendedForm(
  text: string,
  payerPreset: string | null,
): FormId | null {
  // Payer preset is the strongest signal
  if (payerPreset === 'sunlife') return 'aps_490s';
  if (payerPreset === 'abc') return 'abc_60015';
  if (payerPreset === 'ahs_special_auth') return 'ds2444b';

  // Keyword scanning (most specific first)
  if (FORM_CONFIGS.ds2444b.keywords.some((r) => r.test(text))) return 'ds2444b';
  if (FORM_CONFIGS.aps_490s.keywords.some((r) => r.test(text))) return 'aps_490s';
  if (FORM_CONFIGS.abc_60015.keywords.some((r) => r.test(text))) return 'abc_60015';

  return null;
}

// ── Data match calculation ─────────────────────────────────────────────────────

/**
 * Returns the percentage of form fields that can be auto-populated from the
 * available prior auth data.  Fields requiring patient demographics (DOB, PHN)
 * or physician credentials that aren't fetched in the detail panel are scored
 * as unavailable.
 */
export function calculateDataMatch(formId: FormId, data: PdfFormData): number {
  const has = {
    name: !!data.patientName,
    clinical: !!(data.clinicalSummary?.trim()),
    necessity: !!(data.medicalNecessityStatement?.trim()),
    procCodes: data.procedureCodes.length > 0,
    diagCodes: data.diagnosisCodes.length > 0,
    multiDiag: data.diagnosisCodes.length > 1,
    dsmCodes: data.dsmCodes.length > 0,
    stepTherapy: data.stepTherapy.length > 0,
    date: true, // always populated with today's date
  };

  switch (formId) {
    case 'abc_60015': {
      // 14 weighted field-slots:
      // name(1) + dob(1) + phn(1) + procCode(1) + diagCode(1) +
      // clinicalIndication(2) + medicalNecessity(2) + stepTherapy(2) +
      // prescriber(1) + reg(1) + date(1)
      const filled =
        (has.name ? 1 : 0) +
        0 + // DOB — not available in detail fetch
        0 + // PHN — not available in detail fetch
        (has.procCodes ? 1 : 0) +
        (has.diagCodes ? 1 : 0) +
        (has.clinical ? 2 : 0) +
        (has.necessity ? 2 : 0) +
        (has.stepTherapy ? 2 : 0) +
        0 + // prescriber name — not available in detail fetch
        0 + // CPSA registration — not available in detail fetch
        (has.date ? 1 : 0);
      return Math.round((filled / 14) * 100);
    }
    case 'ds2444b': {
      // 16 weighted field-slots:
      // name(1) + dob(1) + phn(1) + primaryDx(1) + secondaryDx(1) +
      // dsmCodes(1) + clinical(3) + stepTherapy(2) + necessity(2) +
      // physician(1) + cpsa(1) + date(1)
      const filled =
        (has.name ? 1 : 0) +
        0 + // DOB
        0 + // PHN
        (has.diagCodes ? 1 : 0) +
        (has.multiDiag ? 1 : 0) +
        (has.dsmCodes ? 1 : 0) +
        (has.clinical ? 3 : 0) + // covers presenting condition + employment impact + functional limitations
        (has.stepTherapy ? 2 : 0) +
        (has.necessity ? 2 : 0) +
        0 + // physician name
        0 + // CPSA reg
        (has.date ? 1 : 0);
      return Math.round((filled / 16) * 100);
    }
    case 'aps_490s': {
      // 15 weighted field-slots:
      // name(1) + dob(1) + policy(1) + certId(1) + primaryDx(1) +
      // secondaryDx(1) + dsmCodes(1) + symptoms(2) + treatment(2) +
      // priorTreatments(2) + physician(1) + license(1)
      // Note: date is included in the header, always present
      const filled =
        (has.name ? 1 : 0) +
        0 + // DOB
        0 + // policy number (payer-specific, not in PA record)
        0 + // certificate ID
        (has.diagCodes ? 1 : 0) +
        (has.multiDiag ? 1 : 0) +
        (has.dsmCodes ? 1 : 0) +
        (has.clinical ? 2 : 0) +
        (has.necessity ? 2 : 0) +
        (has.stepTherapy ? 2 : 0) +
        0 + // physician name
        0; // license number
      return Math.round((filled / 15) * 100);
    }
  }
}
