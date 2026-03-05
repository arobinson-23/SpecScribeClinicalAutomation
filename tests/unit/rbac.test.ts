/**
 * RBAC permission matrix — 100% coverage of every role × resource × action cell.
 *
 * Tests are generated programmatically from the same matrix data as the source,
 * ensuring exhaustive coverage without hundreds of hand-written cases.
 */
import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission } from "@/lib/auth/rbac";
import type { UserRole } from "@prisma/client";

// ── Types (mirrored from rbac.ts, kept in sync) ───────────────────────────────

type Resource =
  | "own_encounters"
  | "other_encounters"
  | "patients"
  | "ai_note_gen"
  | "coding"
  | "prior_auth"
  | "compliance"
  | "analytics"
  | "user_management"
  | "practice_settings"
  | "billing"
  | "audit_logs"
  | "system_config";

type Action = "create" | "read" | "update" | "delete" | "execute";

// ── Expected PERMISSIONS matrix (mirrors src/lib/auth/rbac.ts) ───────────────
// Kept as a test fixture so failures are easy to pinpoint without reading
// source code.

const EXPECTED: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  provider: {
    own_encounters: ["create", "read", "update", "delete"],
    patients: ["create", "read", "update"],
    ai_note_gen: ["execute"],
    coding: ["create", "read", "update", "delete"],
    prior_auth: ["read"],
    compliance: ["read"],
    analytics: ["read"],
  },
  admin: {
    own_encounters: ["read"],
    other_encounters: ["read"],
    patients: ["read"],
    coding: ["read"],
    prior_auth: ["create", "read", "update", "delete"],
    compliance: ["create", "read", "update", "delete"],
    analytics: ["read"],
    user_management: ["create", "read", "update", "delete"],
    practice_settings: ["create", "read", "update", "delete"],
    billing: ["create", "read", "update", "delete"],
    audit_logs: ["read"],
  },
  biller: {
    own_encounters: ["read"],
    other_encounters: ["read"],
    patients: ["read"],
    coding: ["create", "read", "update", "delete"],
    prior_auth: ["create", "read", "update", "delete"],
    compliance: ["read"],
    analytics: ["read"],
    billing: ["read"],
  },
  staff: {
    own_encounters: ["read"],
    patients: ["create", "read"],
    prior_auth: ["create"],
  },
  superadmin: {
    own_encounters: ["read"],
    other_encounters: ["read"],
    patients: ["read"],
    coding: ["read"],
    prior_auth: ["read"],
    compliance: ["create", "read", "update", "delete"],
    analytics: ["read"],
    user_management: ["create", "read", "update", "delete"],
    practice_settings: ["create", "read", "update", "delete"],
    billing: ["create", "read", "update", "delete"],
    audit_logs: ["read"],
    system_config: ["create", "read", "update", "delete"],
  },
};

const ALL_ROLES: UserRole[] = ["provider", "admin", "biller", "staff", "superadmin"];

const ALL_RESOURCES: Resource[] = [
  "own_encounters",
  "other_encounters",
  "patients",
  "ai_note_gen",
  "coding",
  "prior_auth",
  "compliance",
  "analytics",
  "user_management",
  "practice_settings",
  "billing",
  "audit_logs",
  "system_config",
];

const ALL_ACTIONS: Action[] = ["create", "read", "update", "delete", "execute"];

// ── hasPermission — exhaustive matrix ────────────────────────────────────────

describe("hasPermission — full role × resource × action matrix", () => {
  for (const role of ALL_ROLES) {
    describe(`role: ${role}`, () => {
      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          const shouldAllow =
            EXPECTED[role][resource]?.includes(action) ?? false;

          it(`${shouldAllow ? "ALLOWS" : "DENIES"} ${action} on ${resource}`, () => {
            expect(hasPermission(role, resource, action)).toBe(shouldAllow);
          });
        }
      }
    });
  }
});

// ── hasPermission — never throws ─────────────────────────────────────────────

describe("hasPermission — contract", () => {
  it("returns a boolean for every valid combination", () => {
    for (const role of ALL_ROLES) {
      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          const result = hasPermission(role, resource, action);
          expect(typeof result).toBe("boolean");
        }
      }
    }
  });

  it("returns false (not undefined or null) for a denied permission", () => {
    // provider cannot manage users
    expect(hasPermission("provider", "user_management", "create")).toBe(false);
  });

  it("returns false (not undefined or null) for a resource the role has no entry for", () => {
    // staff has no entry for system_config
    expect(hasPermission("staff", "system_config", "read")).toBe(false);
  });
});

// ── requirePermission ────────────────────────────────────────────────────────

describe("requirePermission", () => {
  describe("does not throw when permission is granted", () => {
    it("provider can execute ai_note_gen", () => {
      expect(() =>
        requirePermission("provider", "ai_note_gen", "execute")
      ).not.toThrow();
    });

    it("admin can create users", () => {
      expect(() =>
        requirePermission("admin", "user_management", "create")
      ).not.toThrow();
    });

    it("biller can read coding", () => {
      expect(() =>
        requirePermission("biller", "coding", "read")
      ).not.toThrow();
    });

    it("staff can create patients", () => {
      expect(() =>
        requirePermission("staff", "patients", "create")
      ).not.toThrow();
    });

    it("superadmin can CRUD system_config", () => {
      for (const action of ["create", "read", "update", "delete"] as Action[]) {
        expect(() =>
          requirePermission("superadmin", "system_config", action)
        ).not.toThrow();
      }
    });
  });

  describe("throws FORBIDDEN when permission is denied", () => {
    it("provider cannot manage users", () => {
      expect(() =>
        requirePermission("provider", "user_management", "create")
      ).toThrow(/FORBIDDEN/);
    });

    it("provider cannot access audit_logs", () => {
      expect(() =>
        requirePermission("provider", "audit_logs", "read")
      ).toThrow(/FORBIDDEN/);
    });

    it("admin cannot execute ai_note_gen", () => {
      expect(() =>
        requirePermission("admin", "ai_note_gen", "execute")
      ).toThrow(/FORBIDDEN/);
    });

    it("biller cannot execute ai_note_gen", () => {
      expect(() =>
        requirePermission("biller", "ai_note_gen", "execute")
      ).toThrow(/FORBIDDEN/);
    });

    it("staff cannot access billing", () => {
      expect(() =>
        requirePermission("staff", "billing", "read")
      ).toThrow(/FORBIDDEN/);
    });

    it("staff cannot access coding", () => {
      expect(() =>
        requirePermission("staff", "coding", "create")
      ).toThrow(/FORBIDDEN/);
    });

    it("superadmin cannot execute ai_note_gen", () => {
      expect(() =>
        requirePermission("superadmin", "ai_note_gen", "execute")
      ).toThrow(/FORBIDDEN/);
    });

    it("error message identifies the role, action, and resource", () => {
      let message = "";
      try {
        requirePermission("staff", "user_management", "delete");
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      expect(message).toContain("staff");
      expect(message).toContain("delete");
      expect(message).toContain("user_management");
    });
  });
});

// ── Spot-checks: critical security boundaries ────────────────────────────────

describe("critical security boundaries", () => {
  it("only provider can execute ai_note_gen", () => {
    const canExecute = ALL_ROLES.map((role) => ({
      role,
      allowed: hasPermission(role, "ai_note_gen", "execute"),
    }));
    const allowedRoles = canExecute
      .filter((r) => r.allowed)
      .map((r) => r.role);
    expect(allowedRoles).toEqual(["provider"]);
  });

  it("only admin and superadmin can manage users", () => {
    const canCreate = ALL_ROLES.filter((role) =>
      hasPermission(role, "user_management", "create")
    );
    expect(canCreate.sort()).toEqual(["admin", "superadmin"].sort());
  });

  it("only admin and superadmin can read audit_logs", () => {
    const canRead = ALL_ROLES.filter((role) =>
      hasPermission(role, "audit_logs", "read")
    );
    expect(canRead.sort()).toEqual(["admin", "superadmin"].sort());
  });

  it("only superadmin can access system_config", () => {
    const canRead = ALL_ROLES.filter((role) =>
      hasPermission(role, "system_config", "read")
    );
    expect(canRead).toEqual(["superadmin"]);
  });

  it("no role can delete audit_logs", () => {
    const canDelete = ALL_ROLES.filter((role) =>
      hasPermission(role, "audit_logs", "delete")
    );
    expect(canDelete).toEqual([]);
  });

  it("no role other than provider can access own_encounters with delete", () => {
    const canDelete = ALL_ROLES.filter((role) =>
      hasPermission(role, "own_encounters", "delete")
    );
    expect(canDelete).toEqual(["provider"]);
  });
});
