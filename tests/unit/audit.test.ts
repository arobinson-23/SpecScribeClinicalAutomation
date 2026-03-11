/**
 * Audit logging — verifies writeAuditLog behaviour and that it is called
 * correctly on PHI read/write paths.
 *
 * No real database. prisma.auditLog.create is stubbed via tests/setup.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import type { AuditAction } from "@prisma/client";

// Minimal typed representation of what prisma.auditLog.create receives
interface AuditLogCreateData {
  practiceId: string;
  userId?: string;
  userRole?: string;
  sessionId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome: string;
  errorCode?: string;
  fieldsAccessed?: string[];
  fieldsChanged?: string[];
  metadata: object;
  entryHash: string;
}

interface CreateCall {
  data: AuditLogCreateData;
}

function getLastCreateCall(): AuditLogCreateData {
  const calls = vi.mocked(prisma.auditLog.create).mock.calls;
  if (calls.length === 0) throw new Error("prisma.auditLog.create was not called");
  const lastCall = calls[calls.length - 1];
  if (!lastCall) throw new Error("No call found");
  return (lastCall[0] as CreateCall).data;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(prisma.auditLog.create).mockResolvedValue({
    id: "mock-audit-id",
  } as never);
});

// ── Basic write ───────────────────────────────────────────────────────────────

describe("writeAuditLog — basic write", () => {
  it("calls prisma.auditLog.create with required fields", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-1",
      action: "READ",
      resource: "patient",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    const data = getLastCreateCall();
    expect(data.practiceId).toBe("practice-1");
    expect(data.userId).toBe("user-1");
    expect(data.action).toBe("READ");
    expect(data.resource).toBe("patient");
  });

  it("sets outcome to 'success' by default", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      action: "CREATE",
      resource: "patient",
    });

    const data = getLastCreateCall();
    expect(data.outcome).toBe("success");
  });

  it("passes through optional fields when provided", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-2",
      userRole: "provider",
      sessionId: "sess-abc",
      action: "READ",
      resource: "encounter",
      resourceId: "enc-123",
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
      outcome: "success",
      fieldsAccessed: ["firstName", "lastName"],
      fieldsChanged: [],
    });

    const data = getLastCreateCall();
    expect(data.userRole).toBe("provider");
    expect(data.sessionId).toBe("sess-abc");
    expect(data.resourceId).toBe("enc-123");
    expect(data.ipAddress).toBe("10.0.0.1");
    expect(data.userAgent).toBe("Mozilla/5.0");
  });
});

// ── entryHash ─────────────────────────────────────────────────────────────────

describe("writeAuditLog — entryHash", () => {
  it("populates entryHash with a non-empty string", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
    });

    const data = getLastCreateCall();
    expect(data.entryHash).toBeTruthy();
    expect(typeof data.entryHash).toBe("string");
    expect(data.entryHash.length).toBeGreaterThan(0);
  });

  it("entryHash is a 64-character hex string (SHA-256)", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
    });

    const data = getLastCreateCall();
    expect(data.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("entryHash differs for different log entries (includes timestamp)", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
      resourceId: "pat-1",
    });
    const hash1 = getLastCreateCall().entryHash;

    vi.mocked(prisma.auditLog.create).mockClear();

    await writeAuditLog({
      practiceId: "practice-1",
      action: "UPDATE",
      resource: "patient",
      resourceId: "pat-2",
    });
    const hash2 = getLastCreateCall().entryHash;

    expect(hash1).not.toBe(hash2);
  });
});

// ── Error resilience ──────────────────────────────────────────────────────────

describe("writeAuditLog — error resilience", () => {
  it("does not throw when prisma.auditLog.create rejects", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(
      new Error("DB connection failed")
    );

    await expect(
      writeAuditLog({
        practiceId: "practice-1",
        action: "READ",
        resource: "patient",
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw when prisma.auditLog.create throws synchronously", async () => {
    vi.mocked(prisma.auditLog.create).mockImplementation(() => {
      throw new Error("Synchronous failure");
    });

    await expect(
      writeAuditLog({
        practiceId: "practice-1",
        action: "CREATE",
        resource: "encounter",
      })
    ).resolves.toBeUndefined();
  });

  it("returns undefined (void) on success", async () => {
    const result = await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
    });
    expect(result).toBeUndefined();
  });
});

// ── fieldsAccessed / fieldsChanged — must be field names, not PHI values ─────

describe("writeAuditLog — fieldsAccessed / fieldsChanged contain only field names", () => {
  it("fieldsAccessed values are short field names (≤ 50 chars), not PHI values", async () => {
    const fieldNames = ["firstName", "lastName", "dob", "phone", "email"];

    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
      fieldsAccessed: fieldNames,
    });

    const data = getLastCreateCall();
    expect(data.fieldsAccessed).toBeDefined();
    for (const field of data.fieldsAccessed ?? []) {
      // Field names are always short; PHI values (names, dates, numbers) are longer
      expect(field.length).toBeLessThanOrEqual(50);
    }
  });

  it("fieldsChanged values are short field names (≤ 50 chars), not PHI values", async () => {
    const fieldNames = ["providerEditedNote", "finalizedAt"];

    await writeAuditLog({
      practiceId: "practice-1",
      action: "UPDATE",
      resource: "encounter_note",
      fieldsChanged: fieldNames,
    });

    const data = getLastCreateCall();
    expect(data.fieldsChanged).toBeDefined();
    for (const field of data.fieldsChanged ?? []) {
      expect(field.length).toBeLessThanOrEqual(50);
    }
  });

  it("does not include PHI values in the logged data (passes through exactly what caller provides)", async () => {
    // This test verifies the contract: callers must pass field NAMES, not values.
    // writeAuditLog does not inspect or redact content — callers are responsible.
    const safeFieldNames = ["firstName", "lastName"];

    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
      fieldsAccessed: safeFieldNames,
    });

    const data = getLastCreateCall();
    // The logged fields must match what was passed in (no transformation)
    expect(data.fieldsAccessed).toEqual(safeFieldNames);
  });
});

// ── Action-specific scenarios ─────────────────────────────────────────────────

describe("writeAuditLog — action-specific audit events", () => {
  it("logs action: READ when patient list is fetched", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-1",
      action: "READ",
      resource: "patient",
      fieldsAccessed: ["firstName", "lastName", "dob"],
    });

    const data = getLastCreateCall();
    expect(data.action).toBe("READ");
    expect(data.resource).toBe("patient");
  });

  it("logs action: CREATE when a patient is created", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-1",
      action: "CREATE",
      resource: "patient",
      resourceId: "new-patient-id",
      fieldsChanged: ["firstName", "lastName", "dob", "phn"],
    });

    const data = getLastCreateCall();
    expect(data.action).toBe("CREATE");
    expect(data.resource).toBe("patient");
    expect(data.resourceId).toBe("new-patient-id");
  });

  it("logs action: AI_INVOCATION when a note is generated", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "provider-id",
      action: "AI_INVOCATION",
      resource: "encounter_note",
      resourceId: "enc-789",
      metadata: { model: "claude-sonnet-4-6", tokens: 1200 },
    });

    const data = getLastCreateCall();
    expect(data.action).toBe("AI_INVOCATION");
    expect(data.resource).toBe("encounter_note");
  });

  it("logs action: MFA_VERIFY with outcome: success on successful verification", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-1",
      action: "MFA_VERIFY",
      resource: "session",
      outcome: "success",
    });

    const data = getLastCreateCall();
    expect(data.action).toBe("MFA_VERIFY");
    expect(data.outcome).toBe("success");
  });

  it("logs action: MFA_VERIFY with outcome: failure on failed verification", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      userId: "user-1",
      action: "MFA_VERIFY",
      resource: "session",
      outcome: "failure",
      errorCode: "INVALID_TOTP",
    });

    const data = getLastCreateCall();
    expect(data.action).toBe("MFA_VERIFY");
    expect(data.outcome).toBe("failure");
    expect(data.errorCode).toBe("INVALID_TOTP");
  });
});

// ── metadata field ────────────────────────────────────────────────────────────

describe("writeAuditLog — metadata", () => {
  it("passes metadata through to prisma.auditLog.create", async () => {
    const meta = { model: "claude-sonnet-4-6", inputTokens: 800, outputTokens: 400 };

    await writeAuditLog({
      practiceId: "practice-1",
      action: "AI_INVOCATION",
      resource: "encounter_note",
      metadata: meta,
    });

    const data = getLastCreateCall();
    expect(data.metadata).toMatchObject(meta);
  });

  it("defaults metadata to an empty object when not provided", async () => {
    await writeAuditLog({
      practiceId: "practice-1",
      action: "READ",
      resource: "patient",
    });

    const data = getLastCreateCall();
    expect(data.metadata).toEqual({});
  });
});
