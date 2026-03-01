export interface AHCIPCode {
  code: string;
  description: string;
  category: string;
  modifiers?: string[]; // e.g. TEV (telehealth), CMGP (complex patient)
  requiresPA?: boolean;
  timeUnitsMinutes?: number; // e.g. 08.19A bills per 15-min unit
}

export interface ICD10CACode {
  code: string;
  description: string;
  category: string;
  isSpecific: boolean;     // 7th character complete
  validForPrimary: boolean;
}

export interface ModifierRule {
  modifier: string;
  description: string;
  requirements: string[];
  commonErrors: string[];
}

// Alberta AMA SOMB time-based visit codes
export type AHCIPVisitCode =
  | "03.03A"  // Limited visit
  | "03.04A"  // Comprehensive visit
  | "03.01AD" // Complex patient management add-on
  | "03.07J"  // Prolonged visit add-on
  | "03.08A"  // Complex time-based visit
  | "08.19A"; // Psychiatry counseling (per 15-min unit)

export interface AHCIPVisitCriteria {
  code: AHCIPVisitCode;
  description: string;
  minFaceToFaceMinutes: number;
  requiredElements: string[];
}
