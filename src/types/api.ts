import type { UserRole } from "@prisma/client";

// ─── Branded IDs ─────────────────────────────────────────────────────────────

export type PracticeId = string & { __brand: "PracticeId" };
export type UserId = string & { __brand: "UserId" };
export type PatientId = string & { __brand: "PatientId" };
export type EncounterId = string & { __brand: "EncounterId" };

// ─── Result Pattern ───────────────────────────────────────────────────────────

export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<E = string>(error: E): Result<never, E> {
  return { success: false, error };
}

// ─── API Response Envelope ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cursor?: string;
  };
}

export function apiOk<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return { data, error: null, meta };
}

export function apiErr(error: string): ApiResponse<never> {
  return { data: null, error };
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface AuthSession {
  userId: UserId;
  practiceId: PracticeId;
  role: UserRole;
  mfaVerified: boolean;
  sessionId: string;
  lastActivity: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
