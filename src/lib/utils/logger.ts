/**
 * Structured logger — NEVER include PHI in log messages.
 * Use practice_id, encounter_id, user_id for correlation only.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  practiceId?: string;
  userId?: string;
  encounterId?: string;
  requestId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  // Safety: strip any keys that might accidentally contain PHI
  const safeMeta = Object.fromEntries(
    Object.entries(meta).filter(([k]) =>
      !["firstName", "lastName", "dob", "ssn", "phone", "email", "address",
        "transcript", "note", "clinicalSummary"].includes(k)
    )
  );

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...safeMeta,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
