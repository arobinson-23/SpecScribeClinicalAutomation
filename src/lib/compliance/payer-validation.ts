import { prisma } from "@/lib/db/client";
import type { ComplianceCheckResult, RejectionRisk } from "@/types/compliance";
import type { EncounterCode } from "@prisma/client";

interface ValidateClaimParams {
  encounterId: string;
  practiceId: string;
  payerName: string;
  codes: EncounterCode[];
  noteText: string;
}

export async function validateClaim(params: ValidateClaimParams): Promise<ComplianceCheckResult> {
  const { encounterId, practiceId, payerName, codes, noteText } = params;

  const rejectionRisks: RejectionRisk[] = [];
  const missingElements: string[] = [];
  const modifierIssues: string[] = [];
  const medicalNecessityFlags: string[] = [];

  // Load payer-specific rules
  const practiceRules = await prisma.practicePayerRule.findMany({
    where: { practiceId, active: true },
    include: { payerRule: true },
  });

  const rules = practiceRules
    .map((pr) => pr.payerRule)
    .filter((r) => r.active && r.payerName === payerName);

  // ─── AHCIP Time Documentation Check ────────────────────────────────────
  // Alberta AMA SOMB requires face-to-face time documented for time-based codes
  const hasTimeBasedCode = codes.some(
    (c) => c.codeType === "AHCIP" && ["08.19A", "03.01AD", "03.07J", "03.08A"].includes(c.code)
  );
  const lowerNote = noteText.toLowerCase();
  const hasTimeDocs = /\d+\s*(min|minute|hr|hour)/.test(lowerNote) ||
    lowerNote.includes("start time") || lowerNote.includes("end time") ||
    lowerNote.includes("total time") || lowerNote.includes("face-to-face");

  if (hasTimeBasedCode && !hasTimeDocs) {
    rejectionRisks.push({
      severity: "high",
      ruleId: "AHCIP-TIME-REQUIRED",
      payerName,
      description: "Time-based AHCIP code requires documented face-to-face duration",
      recommendation: "Document total face-to-face time or start/end times in the note per AMA SOMB guidelines",
    });
    modifierIssues.push("Missing time documentation for time-based service code");
  }

  // ─── Medical Necessity / Clinical Indication Check ──────────────────────
  const NECESSITY_KEYWORDS = ["medical necessity", "clinically indicated", "consistent with diagnosis", "clinical indication"];
  const hasMedNecessity = NECESSITY_KEYWORDS.some((kw) => lowerNote.includes(kw));
  if (!hasMedNecessity) {
    medicalNecessityFlags.push("Note does not contain explicit clinical indication language");
  }

  // ─── Signature / Completion Check ──────────────────────────────────────
  if (!lowerNote.includes("signature") && !lowerNote.includes("electronically signed")) {
    missingElements.push("Provider signature or attestation statement");
  }

  // ─── Apply Payer-Specific Rules ─────────────────────────────────────────
  for (const rule of rules) {
    const content = rule.ruleContent as {
      serviceCode?: string;
      forbidden?: boolean;
      requiresModifier?: string;
      message?: string;
    };

    if (content.serviceCode) {
      const affectedCode = codes.find((c) => c.code === content.serviceCode);
      if (affectedCode) {
        if (content.forbidden) {
          rejectionRisks.push({
            severity: "high",
            ruleId: rule.id,
            payerName,
            description: content.message ?? `Service code ${content.serviceCode} not covered by ${payerName}`,
            recommendation: "Remove code or submit with alternative code with supporting documentation",
          });
        }
        if (content.requiresModifier && affectedCode.modifier !== content.requiresModifier) {
          modifierIssues.push(`${payerName} requires modifier ${content.requiresModifier} on ${content.serviceCode}`);
        }
      }
    }
  }

  // ─── Score Calculation ──────────────────────────────────────────────────
  const deductions =
    rejectionRisks.filter((r) => r.severity === "high").length * 20 +
    rejectionRisks.filter((r) => r.severity === "medium").length * 10 +
    missingElements.length * 5 +
    modifierIssues.length * 10 +
    medicalNecessityFlags.length * 5;

  const overallScore = Math.max(0, 100 - deductions);

  return {
    encounterId,
    overallScore,
    rejectionRisks,
    missingElements,
    modifierIssues,
    medicalNecessityFlags,
    passed: overallScore >= 80 && rejectionRisks.filter((r) => r.severity === "high").length === 0,
  };
}
