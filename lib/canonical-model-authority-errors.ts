/**
 * Typed failures for Orvek Canonical Model Authority V1 runtime primitives.
 */

export type CanonicalModelAuthorityErrorCode =
  | "NOT_FOUND"
  | "WRONG_OWNER"
  | "STALE_CURRENT_REVISION"
  | "BROKEN_LEGACY_REGISTRATION"
  | "INVALID_EVIDENCE_OWNERSHIP"
  | "UNSUPPORTED_EVIDENCE_PAIR"
  | "INVALID_UMC_STATUS_MAPPING"
  | "INVALID_UMC_FIELD"
  | "NOT_QUALIFYING_CONCLUSION";

export class CanonicalModelAuthorityError extends Error {
  readonly code: CanonicalModelAuthorityErrorCode;

  constructor(code: CanonicalModelAuthorityErrorCode, message: string) {
    super(message);
    this.name = "CanonicalModelAuthorityError";
    this.code = code;
  }
}

export function isCanonicalModelAuthorityError(
  error: unknown,
): error is CanonicalModelAuthorityError {
  return error instanceof CanonicalModelAuthorityError;
}
