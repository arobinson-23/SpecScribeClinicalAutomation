/**
 * Provincial College Good-Standing Check
 *
 * In Canada, provider discipline is handled by provincial regulatory colleges,
 * not a federal exclusion list. There is no single unified API equivalent to
 * the US OIG LEIE. Each province maintains its own public register:
 *
 *   Alberta:  CPSA — cpsa.ca/physician-search
 *   Ontario:  CPSO — cpso.on.ca/public-register
 *   BC:       CPSBC — cpsbc.ca/physician-search
 *   Quebec:   CMQ — cmq.org/repertoire-medecins
 *
 * TODO: Integrate with province-specific college APIs once available,
 *       or implement a manual verification workflow for onboarding.
 */

export interface ProvincialCollegeCheckResult {
  inGoodStanding: boolean | null; // null = not yet verified
  province: string;
  registrationNumber: string;
  verifiedAt?: Date;
  source: string;
  notes?: string;
}

export async function checkProvincialCollegeStanding(params: {
  province: string;
  registrationNumber: string;
}): Promise<ProvincialCollegeCheckResult> {
  // No unified Canadian API exists — return unverified status for manual review
  return {
    inGoodStanding: null,
    province: params.province,
    registrationNumber: params.registrationNumber,
    source: "Manual verification required — see provincial college public register",
    notes: `Verify at the ${params.province} provincial college website`,
  };
}
