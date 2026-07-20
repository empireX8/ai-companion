/**
 * Shared Objectivity Referee interface (CEQR-001).
 *
 * Interface and outcome union only. No shared AI referee implementation.
 * A no-op / auto-PASS production referee is prohibited.
 */

import type {
  ObjectivityRefereeOutcome,
  RefereeStatus,
} from "./types";

export type { ObjectivityRefereeOutcome, RefereeStatus };

export type ObjectivityRefereeInput = {
  proposedObjectType: string;
  validatedSemanticResult: unknown;
  evidenceSummary: string;
  confidence: number;
  alternativeInterpretation: string;
  qualificationContext: string;
  validationWarnings: string[];
};

export type ObjectivityRefereeEvaluation = {
  outcome: ObjectivityRefereeOutcome;
  rationale: string;
  adjustedConfidence?: number;
  routedObjectType?: string;
};

/**
 * Injectable referee contract. Unbound until a later authorised slice.
 * Callers must leave refereeStatus as `not_run` when no referee is invoked.
 */
export interface ObjectivityReferee {
  evaluate(
    input: ObjectivityRefereeInput,
  ): Promise<ObjectivityRefereeEvaluation> | ObjectivityRefereeEvaluation;
}

export const OBJECTIVITY_REFEREE_OUTCOMES: readonly ObjectivityRefereeOutcome[] = [
  "PASS",
  "PASS_WITH_LOWER_CONFIDENCE",
  "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
  "REQUEST_MORE_EVIDENCE",
  "ABSTAIN",
] as const;

export function isObjectivityRefereeOutcome(
  value: unknown,
): value is ObjectivityRefereeOutcome {
  return (
    typeof value === "string" &&
    (OBJECTIVITY_REFEREE_OUTCOMES as readonly string[]).includes(value)
  );
}

/**
 * Default referee status for CEQR-001: not_run.
 * Explicit test doubles may invoke a referee; production must not auto-PASS.
 */
export function defaultRefereeStatus(): RefereeStatus {
  return "not_run";
}
