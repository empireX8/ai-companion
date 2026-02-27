/**
 * Base class for hard invariant violations — states that are structurally
 * invalid and must be blocked, not just logged.
 */
export class InvariantViolationError extends Error {
  readonly code: string;
  readonly meta?: Record<string, unknown>;

  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "InvariantViolationError";
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Thrown when a write to a WeeklyAudit would violate data validity rules:
 * numeric bounds, top3Ids uniqueness / length, weekStart normalization.
 */
export class WeeklyAuditInvalidDataError extends InvariantViolationError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, "WEEKLY_AUDIT_INVALID_DATA", meta);
    this.name = "WeeklyAuditInvalidDataError";
  }
}

/**
 * Convenience shape for the JSON error body returned on invariant violations.
 * Routes produce: { error: { code, message } }
 */
export type InvariantErrorPayload = {
  error: { code: string; message: string };
};
