/**
 * In-memory rate limiter for MFA verify attempts.
 * Keyed by userId. Max 5 attempts per 5-minute window.
 * On 5th failure: locks for 15 minutes and creates a ComplianceAlert.
 *
 * NOTE: This in-process Map is acceptable for single-instance dev deployment.
 * For multi-instance production, replace with a Redis-based rate limiter
 * (e.g., ioredis with sliding window counters or rate-limiter-flexible library).
 * The Map is module-level so it persists across requests in the same process.
 */

import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

export function checkMfaRateLimit(userId: string): {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntilMs?: number;
} {
  const now = Date.now();
  const record = attempts.get(userId);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Active lockout
  if (record.lockedUntil !== undefined && now < record.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: record.lockedUntil,
    };
  }

  // Window expired — treat as fresh start
  if (now - record.windowStart > WINDOW_MS) {
    attempts.delete(userId);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = MAX_ATTEMPTS - record.count;
  return {
    allowed: remaining > 0,
    remainingAttempts: Math.max(0, remaining),
    lockedUntilMs: record.lockedUntil,
  };
}

export async function recordMfaFailure(
  userId: string,
  practiceId: string
): Promise<void> {
  const now = Date.now();
  const existing = attempts.get(userId);
  const record: AttemptRecord = existing ?? { count: 0, windowStart: now };

  // Reset window if expired
  if (now - record.windowStart > WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
    record.lockedUntil = undefined;
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    logger.warn("MFA_RATE_LIMIT: account locked after repeated failures", {
      userId,
      practiceId,
      failureCount: record.count,
    });

    try {
      // upsert: re-open a previously resolved alert if the attack recurs
      await prisma.complianceAlert.upsert({
        where: {
          practiceId_alertType: {
            practiceId,
            alertType: "mfa_brute_force_lockout",
          },
        },
        create: {
          practiceId,
          alertType: "mfa_brute_force_lockout",
          severity: "critical",
          title: "MFA Brute Force Lockout",
          description:
            "An account was locked after 5 consecutive failed MFA verify attempts within a 5-minute window.",
          entityType: "user",
          entityId: userId,
        },
        update: {
          severity: "critical",
          description:
            "An account was locked after 5 consecutive failed MFA verify attempts within a 5-minute window.",
          entityId: userId,
          resolvedAt: null,
        },
      });
    } catch (error) {
      // Compliance alert failure must never suppress the lockout itself.
      logger.error("MFA_RATE_LIMIT: failed to create compliance alert", {
        practiceId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  attempts.set(userId, record);
}

/** Called on successful MFA verify — clears any failure counter for this user. */
export function clearMfaAttempts(userId: string): void {
  attempts.delete(userId);
}
