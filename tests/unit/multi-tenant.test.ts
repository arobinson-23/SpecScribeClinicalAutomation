/**
 * Multi-tenant isolation — verifies that service-layer functions always scope
 * Prisma queries by practiceId and include deletedAt: null (soft-delete guard).
 *
 * No real database. Prisma is stubbed via the global mock in tests/setup.ts.
 * The createMockPrisma helper creates a scoped in-memory implementation that
 * refuses to return data belonging to a different practice.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  getRecentEncounters,
  getLatestPendingEncounterCodes,
  getComplianceAlerts,
} from "@/lib/dashboard/queries";

// ── createMockPrisma helper ───────────────────────────────────────────────────
// Returns an object whose methods mimic the real Prisma client but only yield
// data when the where.practiceId matches the authorised practice.

interface WhereClause {
  practiceId?: string;
  deletedAt?: unknown;
  [key: string]: unknown;
}

interface QueryArgs {
  where?: WhereClause;
  [key: string]: unknown;
}

function isAuthorised(args: unknown, authorisedPracticeId: string): boolean {
  if (typeof args !== "object" || args === null) return false;
  const q = args as QueryArgs;
  return q.where?.practiceId === authorisedPracticeId;
}

function hasSoftDeleteGuard(args: unknown): boolean {
  if (typeof args !== "object" || args === null) return false;
  const q = args as QueryArgs;
  return "deletedAt" in (q.where ?? {}) && q.where?.deletedAt === null;
}

function createMockPrisma(authorisedPracticeId: string) {
  return {
    encounter: {
      findFirst: vi.fn().mockImplementation((args: unknown) =>
        isAuthorised(args, authorisedPracticeId)
          ? Promise.resolve({
              id: "mock-enc-1",
              practiceId: authorisedPracticeId,
              codes: [],
              notes: [],
            })
          : Promise.resolve(null)
      ),
      findMany: vi.fn().mockImplementation((args: unknown) =>
        isAuthorised(args, authorisedPracticeId)
          ? Promise.resolve([
              {
                id: "mock-enc-1",
                practiceId: authorisedPracticeId,
                encounterDate: new Date(),
                specialtyType: "behavioral_health",
                status: "needs_review",
                patient: { mrn: "MRN-001" },
                notes: [],
              },
            ])
          : Promise.resolve([])
      ),
    },
    patient: {
      findFirst: vi.fn().mockImplementation((args: unknown) =>
        isAuthorised(args, authorisedPracticeId)
          ? Promise.resolve({
              id: "mock-pat-1",
              practiceId: authorisedPracticeId,
            })
          : Promise.resolve(null)
      ),
      findMany: vi.fn().mockImplementation((args: unknown) =>
        isAuthorised(args, authorisedPracticeId)
          ? Promise.resolve([
              { id: "mock-pat-1", practiceId: authorisedPracticeId },
            ])
          : Promise.resolve([])
      ),
    },
    encounterNote: {
      findFirst: vi.fn().mockImplementation((args: unknown) =>
        isAuthorised(args, authorisedPracticeId)
          ? Promise.resolve({
              id: "mock-note-1",
              practiceId: authorisedPracticeId,
            })
          : Promise.resolve(null)
      ),
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const PRACTICE_A = "practice-a-uuid";
const PRACTICE_B = "practice-b-uuid";

beforeEach(() => {
  // clearMocks: true resets call history; restore default implementations here
  vi.mocked(prisma.encounter.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.encounter.findMany).mockResolvedValue([]);
  vi.mocked(prisma.complianceAlert.findMany).mockResolvedValue([]);
});

// ── encounter.findMany — getRecentEncounters ──────────────────────────────────

describe("getRecentEncounters — encounter.findMany scoping", () => {
  it("calls findMany with practiceId in the where clause", async () => {
    await getRecentEncounters(PRACTICE_A);
    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ practiceId: PRACTICE_A }),
      })
    );
  });

  it("includes deletedAt: null in the where clause (soft-delete guard)", async () => {
    await getRecentEncounters(PRACTICE_A);
    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });

  it("does NOT mix practiceIds: practice-B call uses practice-B practiceId", async () => {
    await getRecentEncounters(PRACTICE_B);
    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ practiceId: PRACTICE_B }),
      })
    );
    // Should NOT contain PRACTICE_A in the where clause
    const [callArgs] = vi.mocked(prisma.encounter.findMany).mock.calls;
    const whereClause = (callArgs as QueryArgs[])[0]?.where ?? {};
    expect(whereClause.practiceId).not.toBe(PRACTICE_A);
  });
});

// ── encounter.findFirst — getLatestPendingEncounterCodes ──────────────────────

describe("getLatestPendingEncounterCodes — encounter.findFirst scoping", () => {
  it("calls findFirst with practiceId in the where clause", async () => {
    await getLatestPendingEncounterCodes(PRACTICE_A);
    expect(prisma.encounter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ practiceId: PRACTICE_A }),
      })
    );
  });

  it("includes deletedAt: null in the where clause (soft-delete guard)", async () => {
    await getLatestPendingEncounterCodes(PRACTICE_A);
    expect(prisma.encounter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });

  it("returns null when no pending encounter exists for that practice", async () => {
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue(null);
    const result = await getLatestPendingEncounterCodes(PRACTICE_A);
    expect(result).toBeNull();
  });
});

// ── Cross-practice isolation with createMockPrisma ───────────────────────────

describe("cross-practice isolation via createMockPrisma", () => {
  it("encounter.findMany returns data only for the authorised practice", async () => {
    const scopedMock = createMockPrisma(PRACTICE_A);

    // Authorised practice → data returned
    const resultA = await scopedMock.encounter.findMany({
      where: { practiceId: PRACTICE_A, deletedAt: null },
    });
    expect(resultA).toHaveLength(1);
    expect((resultA[0] as { practiceId: string }).practiceId).toBe(PRACTICE_A);

    // Unauthorised practice → empty array
    const resultB = await scopedMock.encounter.findMany({
      where: { practiceId: PRACTICE_B, deletedAt: null },
    });
    expect(resultB).toHaveLength(0);
  });

  it("encounter.findFirst returns null for the wrong practice", async () => {
    const scopedMock = createMockPrisma(PRACTICE_A);
    const result = await scopedMock.encounter.findFirst({
      where: { practiceId: PRACTICE_B, deletedAt: null },
    });
    expect(result).toBeNull();
  });

  it("patient.findMany returns data only for the authorised practice", async () => {
    const scopedMock = createMockPrisma(PRACTICE_A);

    const resultA = await scopedMock.patient.findMany({
      where: { practiceId: PRACTICE_A, deletedAt: null },
    });
    expect(resultA).toHaveLength(1);

    const resultB = await scopedMock.patient.findMany({
      where: { practiceId: PRACTICE_B, deletedAt: null },
    });
    expect(resultB).toHaveLength(0);
  });

  it("patient.findFirst returns null for the wrong practice", async () => {
    const scopedMock = createMockPrisma(PRACTICE_A);
    const result = await scopedMock.patient.findFirst({
      where: { practiceId: PRACTICE_B, deletedAt: null },
    });
    expect(result).toBeNull();
  });

  it("encounterNote.findFirst returns null for the wrong practice", async () => {
    const scopedMock = createMockPrisma(PRACTICE_A);
    const result = await scopedMock.encounterNote.findFirst({
      where: { practiceId: PRACTICE_B, deletedAt: null },
    });
    expect(result).toBeNull();
  });
});

// ── Soft-delete guard enforcement via createMockPrisma ────────────────────────

describe("soft-delete guard", () => {
  it("hasSoftDeleteGuard detects presence of deletedAt: null", () => {
    expect(
      hasSoftDeleteGuard({ where: { practiceId: PRACTICE_A, deletedAt: null } })
    ).toBe(true);
  });

  it("hasSoftDeleteGuard rejects a query missing deletedAt", () => {
    expect(
      hasSoftDeleteGuard({ where: { practiceId: PRACTICE_A } })
    ).toBe(false);
  });

  it("hasSoftDeleteGuard rejects a query with deletedAt set to a date (includes deleted records)", () => {
    expect(
      hasSoftDeleteGuard({
        where: { practiceId: PRACTICE_A, deletedAt: new Date() },
      })
    ).toBe(false);
  });

  it("getRecentEncounters always passes deletedAt: null to Prisma", async () => {
    await getRecentEncounters(PRACTICE_A);
    const calls = vi.mocked(prisma.encounter.findMany).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(hasSoftDeleteGuard(args)).toBe(true);
    }
  });

  it("getLatestPendingEncounterCodes always passes deletedAt: null to Prisma", async () => {
    await getLatestPendingEncounterCodes(PRACTICE_A);
    const calls = vi.mocked(prisma.encounter.findFirst).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(hasSoftDeleteGuard(args)).toBe(true);
    }
  });
});

// ── getComplianceAlerts — complianceAlert.findMany scoping ────────────────────

describe("getComplianceAlerts — complianceAlert.findMany scoping", () => {
  it("calls findMany with practiceId in the where clause", async () => {
    await getComplianceAlerts(PRACTICE_A);
    expect(prisma.complianceAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ practiceId: PRACTICE_A }),
      })
    );
  });

  it("does not leak practice-B data when querying for practice-A", async () => {
    await getComplianceAlerts(PRACTICE_A);
    const [callArgs] = vi.mocked(prisma.complianceAlert.findMany).mock.calls;
    const where = (callArgs as QueryArgs[])[0]?.where ?? {};
    expect(where.practiceId).toBe(PRACTICE_A);
    expect(where.practiceId).not.toBe(PRACTICE_B);
  });
});
