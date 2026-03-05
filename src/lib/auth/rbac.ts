import type { UserRole } from "@prisma/client";

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
  | "system_config"
  | "ehr_sync";

type Action = "create" | "read" | "update" | "delete" | "execute";

// RBAC matrix — mirrors the spec
const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  provider: {
    own_encounters: ["create", "read", "update", "delete"],
    patients: ["create", "read", "update"],
    ai_note_gen: ["execute"],
    coding: ["create", "read", "update", "delete"],
    prior_auth: ["read"],
    compliance: ["read"],
    analytics: ["read"],
    ehr_sync: ["read"],
  },
  admin: {
    own_encounters: ["read"],
    other_encounters: ["read"],
    patients: ["create", "read", "update"],
    coding: ["read"],
    prior_auth: ["create", "read", "update", "delete"],
    compliance: ["create", "read", "update", "delete"],
    analytics: ["read"],
    user_management: ["create", "read", "update", "delete"],
    practice_settings: ["create", "read", "update", "delete"],
    billing: ["create", "read", "update", "delete"],
    audit_logs: ["read"],
    ehr_sync: ["read", "execute"],
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
    ehr_sync: ["read", "execute"],
  },
};

export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const allowed = PERMISSIONS[role]?.[resource];
  return allowed?.includes(action) ?? false;
}

export function requirePermission(
  role: UserRole,
  resource: Resource,
  action: Action
): void {
  if (!hasPermission(role, resource, action)) {
    throw new Error(`FORBIDDEN: ${role} cannot ${action} ${resource}`);
  }
}
