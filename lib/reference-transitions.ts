export type ReferenceAction =
  | "promote_candidate"
  | "supersede"
  | "deactivate"
  | "update_confidence";

export class ReferenceTransitionError extends Error {
  status = 422;
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Validates that the given action is permitted from the current status.
 * Throws ReferenceTransitionError with code INVALID_STATUS_FOR_ACTION on failure.
 *
 * Status mapping (schema enum):
 *   candidate | active | superseded | inactive
 *
 * promote_candidate  → requires candidate
 * supersede          → requires active
 * deactivate         → requires active or candidate
 * update_confidence  → requires any status except superseded
 */
export function validateReferenceTransition(
  currentStatus: string,
  action: ReferenceAction
): void {
  switch (action) {
    case "promote_candidate":
      if (currentStatus !== "candidate") {
        throw new ReferenceTransitionError(
          "INVALID_STATUS_FOR_ACTION",
          `promote_candidate requires status=candidate, got status=${currentStatus}`
        );
      }
      break;

    case "supersede":
      if (currentStatus !== "active") {
        throw new ReferenceTransitionError(
          "INVALID_STATUS_FOR_ACTION",
          `supersede requires status=active, got status=${currentStatus}`
        );
      }
      break;

    case "deactivate":
      if (currentStatus !== "active" && currentStatus !== "candidate") {
        throw new ReferenceTransitionError(
          "INVALID_STATUS_FOR_ACTION",
          `deactivate requires status=active or candidate, got status=${currentStatus}`
        );
      }
      break;

    case "update_confidence":
      if (currentStatus === "superseded") {
        throw new ReferenceTransitionError(
          "INVALID_STATUS_FOR_ACTION",
          `update_confidence is not allowed for status=superseded`
        );
      }
      break;
  }
}
