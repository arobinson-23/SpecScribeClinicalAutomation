/**
 * Global vitest setup — runs before every test file.
 *
 * Sets required env vars and registers module mocks so no test needs a live
 * database, network connection, or Clerk session.
 */
import { vi } from "vitest";

// ── Environment ──────────────────────────────────────────────────────────────
// 64-char hex string → 32 bytes of key material (AES-256-GCM minimum).
// Not a weak pattern, not all-zeros, not all-F's.
process.env.APP_SECRET =
  "3d7a8f2e1b9c4056a7e3f1d2c8b9a0e53d7a8f2e1b9c4056a7e3f1d2c8b9a0e5";

// ── Prisma stub ──────────────────────────────────────────────────────────────
// Every import of @/lib/db/client in this worker gets these mock functions.
// clearMocks: true (in vitest.config.ts) resets call history before each test
// but preserves the implementations defined here.
vi.mock("@/lib/db/client", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "mock-audit-id" }),
    },
    encounter: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { audioDuration: null } }),
      count: vi.fn().mockResolvedValue(0),
    },
    encounterNote: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    patient: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    complianceAlert: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: "mock-alert-id" }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
  },
}));

// ── Clerk stub ───────────────────────────────────────────────────────────────
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
}));
