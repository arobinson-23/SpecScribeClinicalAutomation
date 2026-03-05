/**
 * Provincial College Good-Standing Screening
 *
 * In Canada, provider discipline is handled by provincial regulatory colleges.
 * No federal exclusion list equivalent to the US OIG LEIE exists.
 * This module implements a structured manual verification workflow:
 *   admin triggers check → records result → system tracks currency
 *
 * Each province's public register:
 *   AB: CPSA  — cpsa.ca/physician-search
 *   ON: CPSO  — cpso.on.ca/public-register
 *   BC: CPSBC — cpsbc.ca/physician-search
 *   MB: CPSM  — cpsm.mb.ca/member-directory
 *   SK: CPSS  — cpss.sk.ca
 *   QC: CMQ   — cmq.org/repertoire-medecins
 */

import { prisma } from "@/lib/db/client";
import { UserRole } from "@prisma/client";
import type { ProviderVerification } from "@prisma/client";

// ─── College Lookup ──────────────────────────────────────────────────────────

export interface CollegeInfo {
  college: string;
  province: string;
  registerUrl: string;
  instructions: string;
}

const COLLEGE_MAP: Record<string, CollegeInfo> = {
  AB: { college: "CPSA",  province: "AB", registerUrl: "https://cpsa.ca/physician-search",          instructions: "Search the CPSA physician register at cpsa.ca/physician-search" },
  ON: { college: "CPSO",  province: "ON", registerUrl: "https://www.cpso.on.ca/public-register",    instructions: "Search the CPSO public register at cpso.on.ca/public-register" },
  BC: { college: "CPSBC", province: "BC", registerUrl: "https://www.cpsbc.ca/physician-search",     instructions: "Search the CPSBC physician register at cpsbc.ca/physician-search" },
  MB: { college: "CPSM",  province: "MB", registerUrl: "https://cpsm.mb.ca/member-directory",      instructions: "Search the CPSM member directory at cpsm.mb.ca/member-directory" },
  SK: { college: "CPSS",  province: "SK", registerUrl: "https://www.cpss.sk.ca",                   instructions: "Search the CPSS physician register at cpss.sk.ca" },
  QC: { college: "CMQ",   province: "QC", registerUrl: "https://www.cmq.org/repertoire-medecins",  instructions: "Search the CMQ physician directory at cmq.org/repertoire-medecins" },
};

export function getCollegeForProvince(province: string): CollegeInfo {
  return (
    COLLEGE_MAP[province.toUpperCase()] ?? {
      college: "Provincial College",
      province,
      registerUrl: "#",
      instructions: `Contact the provincial regulatory college for ${province} to verify physician registration status`,
    }
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | "verified"
  | "expired"
  | "not_in_good_standing"
  | "never_checked";

export interface ProviderVerificationSummary {
  userId: string;
  /** Raw encrypted string — consumer must call decryptPHISafe() before rendering */
  firstName: string | null;
  /** Raw encrypted string — consumer must call decryptPHISafe() before rendering */
  lastName: string | null;
  credentials: string | null;
  /** From User.provincialRegistrationNumber — used as pre-fill fallback */
  provincialRegistrationNumber: string | null;
  /** Province code from most-recent ProviderVerification, or null if never checked */
  province: string | null;
  /** From most-recent ProviderVerification, falling back to User.provincialRegistrationNumber */
  registrationNumber: string | null;
  college: string | null;
  registerUrl: string;
  latestVerification: ProviderVerification | null;
  status: VerificationStatus;
}

export interface PracticeVerificationStatus {
  total: number;
  verified: number;
  expired: number;
  neverChecked: number;
  notInGoodStanding: number;
  providers: ProviderVerificationSummary[];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getLatestVerification(
  userId: string,
  practiceId: string,
): Promise<ProviderVerification | null> {
  return prisma.providerVerification.findFirst({
    where: { userId, practiceId },
    orderBy: { verifiedAt: "desc" },
  });
}

export function isVerificationCurrent(verification: ProviderVerification): boolean {
  return verification.inGoodStanding && verification.expiresAt > new Date();
}

export async function getPracticeVerificationStatus(
  practiceId: string,
): Promise<PracticeVerificationStatus> {
  const providers = await prisma.user.findMany({
    where: {
      practiceId,
      active: true,
      role: { in: [UserRole.provider] },
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      credentials: true,
      provincialRegistrationNumber: true,
    },
  });

  const summaries = await Promise.all(
    providers.map(async (p): Promise<ProviderVerificationSummary> => {
      const latestVerification = await getLatestVerification(p.id, practiceId);
      const province = latestVerification?.province ?? null;
      const collegeInfo = province
        ? getCollegeForProvince(province)
        : getCollegeForProvince("AB"); // Alberta-first default

      let status: VerificationStatus;
      if (!latestVerification) {
        status = "never_checked";
      } else if (!latestVerification.inGoodStanding) {
        status = "not_in_good_standing";
      } else if (latestVerification.expiresAt <= new Date()) {
        status = "expired";
      } else {
        status = "verified";
      }

      return {
        userId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        credentials: p.credentials,
        provincialRegistrationNumber: p.provincialRegistrationNumber,
        province,
        registrationNumber:
          latestVerification?.registrationNumber ??
          p.provincialRegistrationNumber ??
          null,
        college: latestVerification?.college ?? null,
        registerUrl: province ? collegeInfo.registerUrl : "#",
        latestVerification,
        status,
      };
    }),
  );

  return {
    total: summaries.length,
    verified: summaries.filter((s) => s.status === "verified").length,
    expired: summaries.filter((s) => s.status === "expired").length,
    neverChecked: summaries.filter((s) => s.status === "never_checked").length,
    notInGoodStanding: summaries.filter((s) => s.status === "not_in_good_standing").length,
    providers: summaries,
  };
}

// ─── Original Check Function (enhanced) ─────────────────────────────────────

export interface ProvincialCollegeCheckResult {
  inGoodStanding: boolean | null; // null = not yet verified
  province: string;
  registrationNumber: string;
  verifiedAt?: Date;
  source: string;
  notes?: string;
}

export async function checkProvincialCollegeStanding(params: {
  userId: string;
  practiceId: string;
  province: string;
  registrationNumber: string;
}): Promise<ProvincialCollegeCheckResult> {
  const latestVerification = await getLatestVerification(
    params.userId,
    params.practiceId,
  );
  const collegeInfo = getCollegeForProvince(params.province);

  if (!latestVerification) {
    return {
      inGoodStanding: null,
      province: params.province,
      registrationNumber: params.registrationNumber,
      source: `Manual verification required — see ${collegeInfo.college} public register`,
      notes: collegeInfo.instructions,
    };
  }

  return {
    inGoodStanding: latestVerification.inGoodStanding,
    province: params.province,
    registrationNumber: params.registrationNumber,
    verifiedAt: latestVerification.verifiedAt,
    source: `Manually verified against ${latestVerification.college} public register`,
    notes: latestVerification.notes ?? undefined,
  };
}
