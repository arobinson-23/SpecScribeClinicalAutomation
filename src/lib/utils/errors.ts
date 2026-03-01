export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(code: "INVALID_SESSION" | "MFA_REQUIRED" | "SESSION_EXPIRED" | "FORBIDDEN" | "ACCOUNT_LOCKED") {
    const messages: Record<typeof code, string> = {
      INVALID_SESSION: "Invalid or expired session",
      MFA_REQUIRED: "MFA verification required",
      SESSION_EXPIRED: "Session has expired due to inactivity",
      FORBIDDEN: "You do not have permission to perform this action",
      ACCOUNT_LOCKED: "Account temporarily locked due to failed login attempts",
    };
    super(messages[code], code, code === "FORBIDDEN" ? 403 : 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 422);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Too many requests. Please try again later.", "RATE_LIMIT", 429);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function toApiError(e: unknown): { message: string; code: string; statusCode: number } {
  if (isAppError(e)) {
    return { message: e.message, code: e.code, statusCode: e.statusCode };
  }
  return { message: "An unexpected error occurred", code: "INTERNAL_ERROR", statusCode: 500 };
}
