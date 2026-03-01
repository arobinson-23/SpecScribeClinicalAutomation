export interface RejectionRisk {
  severity: "high" | "medium" | "low";
  ruleId: string;
  payerName: string;
  description: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  encounterId: string;
  overallScore: number; // 0–100
  rejectionRisks: RejectionRisk[];
  missingElements: string[];
  modifierIssues: string[];
  medicalNecessityFlags: string[];
  passed: boolean;
}

export interface PriorAuthRequirement {
  required: boolean;
  payerName: string;
  serviceCodes: string[]; // AHCIP service codes
  estimatedTurnaround: string;
  submissionUrl?: string;
  clinicalCriteriaUrl?: string;
  notes: string;
}
