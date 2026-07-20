/**
 * Shared Objectivity Referee interface (CEQR-001 + dependency-gate patch).
 *
 * Interface, outcome union, deterministic evaluation validation, continuation
 * policy, and fail-closed execution wrapper only.
 *
 * No shared AI referee implementation.
 * A no-op / auto-PASS production referee is prohibited.
 *
 * PASS means: may continue to a later deterministic persistence gate.
 * PASS never means: persist now.
 */

import { CONFIDENCE_MAX, CONFIDENCE_MIN } from "./contracts";
import type {
  ObjectivityRefereeOutcome,
  RefereeStatus,
} from "./types";

export type { ObjectivityRefereeOutcome, RefereeStatus };

/**
 * Dedicated referee interface version.
 * Independent of contradiction prompt/schema versions and of KERNEL_CONTRACT_VERSION.
 * Introduced by OBJECTIVITY-REFEREE-INTERFACE-DEPENDENCY-GATE-001.
 */
export const OBJECTIVITY_REFEREE_INTERFACE_VERSION =
  "objectivity-referee-interface-v1" as const;

export type ObjectivityRefereeExecutionState =
  | "not_run"
  | "completed"
  | "failed"
  | "invalid_evaluation";

export type ObjectivityRefereeInput = {
  proposedObjectType: string;
  validatedSemanticResult: unknown;
  evidenceSummary: string;
  confidence: number;
  alternativeInterpretation: string;
  qualificationContext: string;
  validationWarnings: string[];
};

/**
 * Raw evaluation returned by an injected referee implementation.
 * Must pass `validateObjectivityRefereeEvaluation` before use.
 */
export type ObjectivityRefereeEvaluation = {
  outcome: ObjectivityRefereeOutcome;
  rationale: string;
  adjustedConfidence?: number;
  routedObjectType?: string;
};

/**
 * Injectable referee contract. Unbound until a later authorised slice.
 * Callers must leave executionState as `not_run` when no referee is invoked.
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
 * Default referee status for callers that only need a summary string.
 * Explicit test doubles may invoke a referee; production must not auto-PASS.
 */
export function defaultRefereeStatus(): RefereeStatus {
  return "not_run";
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeObjectType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export type ObjectivityRefereeValidationResult =
  | {
      ok: true;
      evaluation: {
        outcome: ObjectivityRefereeOutcome;
        rationale: string;
        adjustedConfidence: number | null;
        routedObjectType: string | null;
      };
    }
  | {
      ok: false;
      errors: string[];
    };

/**
 * Outcome-specific deterministic validation.
 * Malformed combinations fail closed.
 */
export function validateObjectivityRefereeEvaluation(args: {
  evaluation: unknown;
  proposedObjectType: string;
  proposedConfidence: number;
}): ObjectivityRefereeValidationResult {
  const errors: string[] = [];
  const evaluation = args.evaluation;

  if (evaluation == null || typeof evaluation !== "object") {
    return {
      ok: false,
      errors: ["referee_evaluation_malformed: evaluation must be an object."],
    };
  }

  const record = evaluation as Record<string, unknown>;
  const outcome = record.outcome;
  const rationale = record.rationale;
  const adjustedConfidence = record.adjustedConfidence;
  const routedObjectType = record.routedObjectType;

  if (!isObjectivityRefereeOutcome(outcome)) {
    errors.push(
      `referee_evaluation_invalid_outcome: ${String(outcome)} is not an authorised ObjectivityRefereeOutcome.`,
    );
  }

  if (!isNonBlankString(rationale)) {
    errors.push(
      "referee_evaluation_blank_rationale: rationale must be a non-blank string.",
    );
  }

  if (errors.length > 0 || !isObjectivityRefereeOutcome(outcome)) {
    return { ok: false, errors };
  }

  let validatedAdjusted: number | null = null;
  let validatedRouted: string | null = null;

  if (outcome === "PASS") {
    if (adjustedConfidence !== undefined) {
      // Optional on PASS; if present must still be a finite 0–1 number.
      if (
        typeof adjustedConfidence !== "number" ||
        !Number.isFinite(adjustedConfidence) ||
        adjustedConfidence < CONFIDENCE_MIN ||
        adjustedConfidence > CONFIDENCE_MAX
      ) {
        errors.push(
          "referee_evaluation_invalid_adjusted_confidence: optional PASS adjustedConfidence must be a finite number in [0,1].",
        );
      } else {
        validatedAdjusted = adjustedConfidence;
      }
    }
  } else if (outcome === "PASS_WITH_LOWER_CONFIDENCE") {
    if (
      typeof adjustedConfidence !== "number" ||
      !Number.isFinite(adjustedConfidence)
    ) {
      errors.push(
        "referee_evaluation_missing_adjusted_confidence: PASS_WITH_LOWER_CONFIDENCE requires a finite adjustedConfidence.",
      );
    } else if (
      adjustedConfidence < CONFIDENCE_MIN ||
      adjustedConfidence > CONFIDENCE_MAX
    ) {
      errors.push(
        "referee_evaluation_adjusted_confidence_out_of_range: adjustedConfidence must be in [0,1].",
      );
    } else if (!(adjustedConfidence < args.proposedConfidence)) {
      errors.push(
        "referee_evaluation_adjusted_confidence_not_lower: adjustedConfidence must be strictly lower than proposed confidence.",
      );
    } else {
      validatedAdjusted = adjustedConfidence;
    }
  } else if (outcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
    if (!isNonBlankString(routedObjectType)) {
      errors.push(
        "referee_evaluation_missing_routed_object_type: ROUTE_TO_DIFFERENT_OBJECT_TYPE requires a non-blank routedObjectType.",
      );
    } else if (
      normalizeObjectType(routedObjectType) ===
      normalizeObjectType(args.proposedObjectType)
    ) {
      errors.push(
        "referee_evaluation_routed_type_not_different: routedObjectType must not equal the proposed object type after normalisation.",
      );
    } else {
      validatedRouted = routedObjectType.trim();
    }
  } else if (
    outcome === "REQUEST_MORE_EVIDENCE" ||
    outcome === "ABSTAIN"
  ) {
    // Rationale already required; no adjusted confidence / routed type required.
    if (adjustedConfidence !== undefined) {
      errors.push(
        `referee_evaluation_unexpected_adjusted_confidence: ${outcome} must not carry adjustedConfidence.`,
      );
    }
    if (routedObjectType !== undefined && isNonBlankString(routedObjectType)) {
      // Allow absent; reject affirmative routed type on block outcomes.
      errors.push(
        `referee_evaluation_unexpected_routed_object_type: ${outcome} must not carry routedObjectType.`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    evaluation: {
      outcome,
      rationale: (rationale as string).trim(),
      adjustedConfidence: validatedAdjusted,
      routedObjectType: validatedRouted,
    },
  };
}

/**
 * Continuation / gate eligibility after a referee result.
 *
 * Named deliberately: this is NOT persistence authorisation.
 * A later deterministic persistence gate must still pass.
 */
export function refereeAllowsContinuation(
  result: Pick<
    ObjectivityRefereeResult,
    "executionState" | "outcome" | "validationErrors"
  >,
): boolean {
  if (result.executionState !== "completed") {
    return false;
  }
  if (result.validationErrors.length > 0) {
    return false;
  }
  return (
    result.outcome === "PASS" ||
    result.outcome === "PASS_WITH_LOWER_CONFIDENCE"
  );
}

export type ObjectivityRefereeResult = {
  interfaceVersion: typeof OBJECTIVITY_REFEREE_INTERFACE_VERSION;
  executionState: ObjectivityRefereeExecutionState;
  /** Validated outcome when executionState === "completed"; otherwise null. */
  outcome: ObjectivityRefereeOutcome | null;
  rationale: string | null;
  proposedObjectType: string | null;
  proposedConfidence: number | null;
  adjustedConfidence: number | null;
  routedObjectType: string | null;
  validationErrors: string[];
  /**
   * Whether the proposal may continue to a later deterministic persistence gate.
   * Never means persist now. Never sets persistenceAuthorised.
   */
  continuationAllowed: boolean;
  errorMessage: string | null;
};

export function notRunObjectivityRefereeResult(): ObjectivityRefereeResult {
  const base: ObjectivityRefereeResult = {
    interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
    executionState: "not_run",
    outcome: null,
    rationale: null,
    proposedObjectType: null,
    proposedConfidence: null,
    adjustedConfidence: null,
    routedObjectType: null,
    validationErrors: [],
    continuationAllowed: false,
    errorMessage: null,
  };
  return {
    ...base,
    continuationAllowed: refereeAllowsContinuation(base),
  };
}

function toSummaryStatus(result: ObjectivityRefereeResult): RefereeStatus {
  if (result.executionState === "not_run") {
    return "not_run";
  }
  if (result.executionState === "failed") {
    return "execution_failed";
  }
  if (result.executionState === "invalid_evaluation") {
    return "invalid_evaluation";
  }
  if (result.outcome != null) {
    return result.outcome;
  }
  return "invalid_evaluation";
}

export function objectivityRefereeResultToStatus(
  result: ObjectivityRefereeResult,
): RefereeStatus {
  return toSummaryStatus(result);
}

/**
 * Fail-closed referee execution.
 * Distinguishes not_run, completed, failed, and invalid_evaluation.
 * Never invents PASS on failure. Never authorises persistence.
 */
export async function runObjectivityRefereeSafely(args: {
  referee: ObjectivityReferee | undefined | null;
  input: ObjectivityRefereeInput;
}): Promise<ObjectivityRefereeResult> {
  if (!args.referee) {
    return notRunObjectivityRefereeResult();
  }

  let raw: unknown;
  try {
    raw = await args.referee.evaluate(args.input);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown_error");
    const failed: ObjectivityRefereeResult = {
      interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
      executionState: "failed",
      outcome: null,
      rationale: null,
      proposedObjectType: args.input.proposedObjectType,
      proposedConfidence: args.input.confidence,
      adjustedConfidence: null,
      routedObjectType: null,
      validationErrors: [`referee_execution_failed: ${message}`],
      continuationAllowed: false,
      errorMessage: message,
    };
    return {
      ...failed,
      continuationAllowed: refereeAllowsContinuation(failed),
    };
  }

  const validated = validateObjectivityRefereeEvaluation({
    evaluation: raw,
    proposedObjectType: args.input.proposedObjectType,
    proposedConfidence: args.input.confidence,
  });

  if (!validated.ok) {
    const invalid: ObjectivityRefereeResult = {
      interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
      executionState: "invalid_evaluation",
      outcome: null,
      rationale: null,
      proposedObjectType: args.input.proposedObjectType,
      proposedConfidence: args.input.confidence,
      adjustedConfidence: null,
      routedObjectType: null,
      validationErrors: validated.errors,
      continuationAllowed: false,
      errorMessage: validated.errors.join(" | "),
    };
    return {
      ...invalid,
      continuationAllowed: refereeAllowsContinuation(invalid),
    };
  }

  const completed: ObjectivityRefereeResult = {
    interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
    executionState: "completed",
    outcome: validated.evaluation.outcome,
    rationale: validated.evaluation.rationale,
    proposedObjectType: args.input.proposedObjectType,
    proposedConfidence: args.input.confidence,
    adjustedConfidence: validated.evaluation.adjustedConfidence,
    routedObjectType: validated.evaluation.routedObjectType,
    validationErrors: [],
    continuationAllowed: false,
    errorMessage: null,
  };

  return {
    ...completed,
    continuationAllowed: refereeAllowsContinuation(completed),
  };
}
