/**
 * Contradiction confidence policy (CEQR-006).
 *
 * Pure, deterministic, versioned engineering policy that converts validated
 * model-reported confidence + semantic adjudication + Objectivity Referee
 * signals into a persistence-facing confidence *recommendation*.
 *
 * This is NOT empirical/statistical calibration.
 * Model-reported confidence is NOT a probability estimate.
 * A storage-band recommendation does NOT authorise persistence.
 * A referee continuation outcome does NOT authorise persistence.
 *
 * Output semantics:
 * - `ok` = the confidence policy successfully evaluated valid inputs
 * - `meetsCandidateFloor` = the effective score passed the candidate threshold
 * - `continuationReady` = all semantic/referee/confidence gates passed AND
 *   the candidate floor was met
 * - `persistable` / `persistenceAuthorised` remain false always
 *
 * Forbidden inputs (must not influence this policy):
 * - ContradictionType / marker family / rhetorical phrases
 * - token overlap / textual similarity / candidate volume
 * - ReferenceItem type / goal-versus-behaviour / constraint-conflict category
 * - legacy hard-coded low/medium/high type labels
 */

import { CONFIDENCE_MAX, CONFIDENCE_MIN } from "./orvek-intelligence-kernel/contracts";
import type { ContradictionClassification } from "./orvek-intelligence-kernel/contracts";
import type {
  DeterministicValidationStatus,
  KernelAdjudicationOutcomeKind,
  ObjectivityRefereeOutcome,
} from "./orvek-intelligence-kernel/types";
import type { ObjectivityRefereeExecutionState } from "./orvek-intelligence-kernel/objectivity-referee";
import { classificationAllowsContradictionNodeSemantics } from "./contradiction-adjudicator";

/**
 * Independent policy version — not tied to kernel, prompt, schema, or referee
 * interface versions.
 */
export const CONTRADICTION_CONFIDENCE_POLICY_VERSION =
  "contradiction-confidence-policy-v1" as const;

/**
 * Candidate floor for policy-calibrated effective confidence.
 * Scores below this still yield a successful evaluation (`ok: true`) with
 * `meetsCandidateFloor: false` and `continuationReady: false` (not fail-closed).
 *
 * Engineering threshold only — not an observed accuracy rate.
 */
export const CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR = 0.5 as const;

/**
 * Storage-band boundaries on effective confidence ∈ [0,1].
 * Maps onto the existing Prisma `ReferenceConfidence` enum values without
 * importing Prisma.
 *
 *   high:   [0.80, 1.00]
 *   medium: [0.50, 0.80)
 *   low:    [0.00, 0.50)
 */
export const CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN = 0.8 as const;
export const CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN = 0.5 as const;

/** Persistence-facing storage-band recommendation (enum-compatible strings). */
export type RecommendedStorageConfidence = "low" | "medium" | "high";

export type EffectiveConfidenceSource =
  | "model_reported"
  | "referee_adjusted_required"
  | "referee_adjusted_optional";

export type ContradictionConfidenceCalibrationFailureCode =
  | "model_confidence_missing"
  | "model_confidence_non_finite"
  | "model_confidence_out_of_range"
  | "adjudication_not_semantic_accepted"
  | "deterministic_validation_invalid"
  | "semantic_payload_missing"
  | "classification_not_clear_contradiction"
  | "referee_not_run"
  | "referee_failed"
  | "referee_invalid_evaluation"
  | "referee_validation_errors_missing"
  | "referee_validation_errors_malformed"
  | "referee_continuation_evidence_missing"
  | "referee_continuation_blocked"
  | "referee_outcome_unsupported"
  | "pass_with_lower_missing_adjustment"
  | "adjusted_confidence_malformed"
  | "adjusted_confidence_out_of_range"
  | "adjusted_confidence_not_strictly_lower"
  | "optional_pass_adjustment_increase_forbidden"
  | "optional_pass_adjustment_not_strictly_lower";

export type ContradictionConfidenceCalibrationInput = {
  /**
   * Model-reported numeric confidence in [0,1].
   * Missing / non-finite / out-of-range values fail closed (no silent clamp).
   */
  modelReportedConfidence: number | null | undefined;
  adjudicationOutcome: KernelAdjudicationOutcomeKind;
  deterministicValidationStatus: DeterministicValidationStatus;
  /** False when semantic payload is absent. */
  semanticPresent: boolean;
  semanticClassification: ContradictionClassification | null;
  refereeExecutionState: ObjectivityRefereeExecutionState;
  refereeOutcome: ObjectivityRefereeOutcome | null;
  /**
   * Validated referee-adjusted confidence when present.
   * Required and must be strictly lower for PASS_WITH_LOWER_CONFIDENCE.
   * Optional for PASS; if present must be a valid strictly-lower score
   * (increases and equality fail closed under this policy).
   */
  refereeAdjustedConfidence?: number | null;
  /**
   * Required validated referee gate evidence.
   * Must be an array (runtime-checked) and empty for continuation.
   * Omitted / null / non-array values fail closed — never inferred from PASS.
   */
  refereeValidationErrors: readonly string[];
  /**
   * Required validated referee continuation result.
   * Must be exactly `true` for continuation.
   * Omitted / undefined / null / false fail closed — never inferred from PASS.
   */
  refereeContinuationAllowed: boolean;
};

type ContradictionConfidenceCalibrationSuccessBase = {
  ok: true;
  confidencePolicyVersion: typeof CONTRADICTION_CONFIDENCE_POLICY_VERSION;
  modelReportedConfidence: number;
  effectiveConfidence: number;
  effectiveConfidenceSource: EffectiveConfidenceSource;
  recommendedStorageConfidence: RecommendedStorageConfidence;
  candidateConfidenceFloor: typeof CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR;
  refereeOutcome: "PASS" | "PASS_WITH_LOWER_CONFIDENCE";
  warnings: string[];
  /** Explicit non-persistence markers — recommendation only. */
  persistable: false;
  persistenceAuthorised: false;
  createCandidate: undefined;
  persistenceDecision: null;
};

/**
 * Successful policy evaluation.
 * `continuationReady` is true only when the candidate floor is also met.
 */
export type ContradictionConfidenceCalibrationSuccess =
  | (ContradictionConfidenceCalibrationSuccessBase & {
      meetsCandidateFloor: true;
      continuationReady: true;
    })
  | (ContradictionConfidenceCalibrationSuccessBase & {
      meetsCandidateFloor: false;
      continuationReady: false;
    });

export type ContradictionConfidenceCalibrationFailure = {
  ok: false;
  continuationReady: false;
  confidencePolicyVersion: typeof CONTRADICTION_CONFIDENCE_POLICY_VERSION;
  code: ContradictionConfidenceCalibrationFailureCode;
  message: string;
  modelReportedConfidence: number | null;
  effectiveConfidence: null;
  effectiveConfidenceSource: null;
  recommendedStorageConfidence: null;
  meetsCandidateFloor: false;
  candidateConfidenceFloor: typeof CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR;
  refereeOutcome: ObjectivityRefereeOutcome | null;
  warnings: string[];
  persistable: false;
  persistenceAuthorised: false;
  createCandidate: undefined;
  persistenceDecision: null;
};

export type ContradictionConfidenceCalibrationResult =
  | ContradictionConfidenceCalibrationSuccess
  | ContradictionConfidenceCalibrationFailure;

function fail(
  code: ContradictionConfidenceCalibrationFailureCode,
  message: string,
  partial: {
    modelReportedConfidence?: number | null;
    refereeOutcome?: ObjectivityRefereeOutcome | null;
    warnings?: string[];
  } = {},
): ContradictionConfidenceCalibrationFailure {
  return {
    ok: false,
    continuationReady: false,
    confidencePolicyVersion: CONTRADICTION_CONFIDENCE_POLICY_VERSION,
    code,
    message,
    modelReportedConfidence:
      partial.modelReportedConfidence === undefined
        ? null
        : partial.modelReportedConfidence,
    effectiveConfidence: null,
    effectiveConfidenceSource: null,
    recommendedStorageConfidence: null,
    meetsCandidateFloor: false,
    candidateConfidenceFloor: CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR,
    refereeOutcome: partial.refereeOutcome ?? null,
    warnings: partial.warnings ?? [],
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };
}

/**
 * Internal band mapper. Not exported — callers must use
 * `calibrateContradictionConfidence` so finite [0,1] validation always runs.
 */
function mapEffectiveConfidenceToStorageBand(
  effectiveConfidence: number,
): RecommendedStorageConfidence {
  if (effectiveConfidence >= CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN) {
    return "high";
  }
  if (effectiveConfidence >= CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN) {
    return "medium";
  }
  return "low";
}

function isFiniteUnitInterval(value: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= CONFIDENCE_MIN &&
    value <= CONFIDENCE_MAX
  );
}

/**
 * Authoritative confidence policy for repaired contradiction proposals.
 *
 * Valid score below the candidate floor → successful evaluation (`ok: true`)
 * with `meetsCandidateFloor: false` and `continuationReady: false`
 * (inspectable; not fail-closed).
 * Blocking referee outcomes and invalid inputs → fail closed (no low-band
 * recommendation substituted).
 */
export function calibrateContradictionConfidence(
  input: ContradictionConfidenceCalibrationInput,
): ContradictionConfidenceCalibrationResult {
  const warnings: string[] = [];
  const rawModel = input.modelReportedConfidence;
  const refereeOutcome = input.refereeOutcome;

  if (rawModel === null || rawModel === undefined) {
    return fail(
      "model_confidence_missing",
      "Model-reported confidence is missing; confidence policy fails closed.",
      { refereeOutcome },
    );
  }

  if (typeof rawModel !== "number" || !Number.isFinite(rawModel)) {
    return fail(
      "model_confidence_non_finite",
      `Model-reported confidence is non-finite (${String(rawModel)}); no silent clamp.`,
      { modelReportedConfidence: null, refereeOutcome },
    );
  }

  if (rawModel < CONFIDENCE_MIN || rawModel > CONFIDENCE_MAX) {
    return fail(
      "model_confidence_out_of_range",
      `Model-reported confidence ${rawModel} is outside [0,1]; no silent clamp.`,
      { modelReportedConfidence: rawModel, refereeOutcome },
    );
  }

  const modelReportedConfidence = rawModel;

  if (input.adjudicationOutcome !== "semantic_accepted") {
    return fail(
      "adjudication_not_semantic_accepted",
      `Adjudication outcome ${input.adjudicationOutcome} is not semantic_accepted.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.deterministicValidationStatus !== "valid") {
    return fail(
      "deterministic_validation_invalid",
      `Deterministic adjudication validation status is ${input.deterministicValidationStatus}.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (!input.semanticPresent || input.semanticClassification == null) {
    return fail(
      "semantic_payload_missing",
      "Semantic payload is missing; confidence policy fails closed.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (
    !classificationAllowsContradictionNodeSemantics(input.semanticClassification)
  ) {
    return fail(
      "classification_not_clear_contradiction",
      `Semantic classification ${input.semanticClassification} is not clear_contradiction.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeExecutionState === "not_run") {
    return fail(
      "referee_not_run",
      "Objectivity Referee was not run; confidence recommendation blocked.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeExecutionState === "failed") {
    return fail(
      "referee_failed",
      "Objectivity Referee execution failed; confidence recommendation blocked.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeExecutionState === "invalid_evaluation") {
    return fail(
      "referee_invalid_evaluation",
      "Objectivity Referee evaluation is invalid; confidence recommendation blocked.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeExecutionState !== "completed") {
    return fail(
      "referee_outcome_unsupported",
      `Unsupported referee execution state: ${String(input.refereeExecutionState)}.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  // Validated referee gate evidence is mandatory — never inferred from PASS.
  if (
    input.refereeValidationErrors === undefined ||
    input.refereeValidationErrors === null
  ) {
    return fail(
      "referee_validation_errors_missing",
      "Referee validationErrors evidence is missing; confidence policy fails closed.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (!Array.isArray(input.refereeValidationErrors)) {
    return fail(
      "referee_validation_errors_malformed",
      "Referee validationErrors must be an array; confidence policy fails closed.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeValidationErrors.length > 0) {
    return fail(
      "referee_invalid_evaluation",
      `Referee validation errors present: ${input.refereeValidationErrors.join(" | ")}`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (
    refereeOutcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE" ||
    refereeOutcome === "REQUEST_MORE_EVIDENCE" ||
    refereeOutcome === "ABSTAIN"
  ) {
    return fail(
      "referee_continuation_blocked",
      `Referee outcome ${refereeOutcome} blocks contradiction-confidence recommendation.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (refereeOutcome !== "PASS" && refereeOutcome !== "PASS_WITH_LOWER_CONFIDENCE") {
    return fail(
      "referee_outcome_unsupported",
      `Unsupported or missing referee outcome: ${String(refereeOutcome)}.`,
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (
    input.refereeContinuationAllowed === undefined ||
    input.refereeContinuationAllowed === null
  ) {
    return fail(
      "referee_continuation_evidence_missing",
      "Referee continuationAllowed evidence is missing; confidence policy fails closed.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  if (input.refereeContinuationAllowed !== true) {
    return fail(
      "referee_continuation_blocked",
      "Referee continuationAllowed is not true; confidence recommendation blocked.",
      { modelReportedConfidence, refereeOutcome },
    );
  }

  const adjusted = input.refereeAdjustedConfidence;
  let effectiveConfidence: number;
  let effectiveConfidenceSource: EffectiveConfidenceSource;

  if (refereeOutcome === "PASS_WITH_LOWER_CONFIDENCE") {
    if (adjusted === null || adjusted === undefined) {
      return fail(
        "pass_with_lower_missing_adjustment",
        "PASS_WITH_LOWER_CONFIDENCE requires a finite adjusted confidence.",
        { modelReportedConfidence, refereeOutcome },
      );
    }
    if (typeof adjusted !== "number" || !Number.isFinite(adjusted)) {
      return fail(
        "adjusted_confidence_malformed",
        `Adjusted confidence is malformed (${String(adjusted)}); no silent clamp.`,
        { modelReportedConfidence, refereeOutcome },
      );
    }
    if (!isFiniteUnitInterval(adjusted)) {
      return fail(
        "adjusted_confidence_out_of_range",
        `Adjusted confidence ${adjusted} is outside [0,1]; no silent clamp.`,
        { modelReportedConfidence, refereeOutcome },
      );
    }
    if (!(adjusted < modelReportedConfidence)) {
      return fail(
        "adjusted_confidence_not_strictly_lower",
        `Adjusted confidence ${adjusted} must be strictly lower than model-reported ${modelReportedConfidence}.`,
        { modelReportedConfidence, refereeOutcome },
      );
    }
    effectiveConfidence = adjusted;
    effectiveConfidenceSource = "referee_adjusted_required";
  } else {
    // PASS — optional adjustment only when explicitly authorised as a lowering.
    if (adjusted !== null && adjusted !== undefined) {
      if (typeof adjusted !== "number" || !Number.isFinite(adjusted)) {
        return fail(
          "adjusted_confidence_malformed",
          `Optional PASS adjusted confidence is malformed (${String(adjusted)}).`,
          { modelReportedConfidence, refereeOutcome },
        );
      }
      if (!isFiniteUnitInterval(adjusted)) {
        return fail(
          "adjusted_confidence_out_of_range",
          `Optional PASS adjusted confidence ${adjusted} is outside [0,1].`,
          { modelReportedConfidence, refereeOutcome },
        );
      }
      if (adjusted > modelReportedConfidence) {
        return fail(
          "optional_pass_adjustment_increase_forbidden",
          `Optional PASS adjusted confidence ${adjusted} exceeds model-reported ${modelReportedConfidence}; increases are forbidden.`,
          { modelReportedConfidence, refereeOutcome },
        );
      }
      if (!(adjusted < modelReportedConfidence)) {
        return fail(
          "optional_pass_adjustment_not_strictly_lower",
          `Optional PASS adjusted confidence ${adjusted} equals model-reported ${modelReportedConfidence}; equality is not a valid lowering.`,
          { modelReportedConfidence, refereeOutcome },
        );
      }
      effectiveConfidence = adjusted;
      effectiveConfidenceSource = "referee_adjusted_optional";
      warnings.push(
        "optional_pass_adjustment_applied: effective confidence uses referee-adjusted score; model-reported remains inspectable.",
      );
    } else {
      effectiveConfidence = modelReportedConfidence;
      effectiveConfidenceSource = "model_reported";
    }
  }

  const recommendedStorageConfidence =
    mapEffectiveConfidenceToStorageBand(effectiveConfidence);
  const meetsCandidateFloor =
    effectiveConfidence >= CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR;

  const successBase: ContradictionConfidenceCalibrationSuccessBase = {
    ok: true,
    confidencePolicyVersion: CONTRADICTION_CONFIDENCE_POLICY_VERSION,
    modelReportedConfidence,
    effectiveConfidence,
    effectiveConfidenceSource,
    recommendedStorageConfidence,
    candidateConfidenceFloor: CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR,
    refereeOutcome,
    warnings,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };

  if (!meetsCandidateFloor) {
    warnings.push(
      "below_candidate_floor: evaluation succeeded with meetsCandidateFloor = false and continuationReady = false; not fail-closed; persistence remains unauthorised.",
    );
    return {
      ...successBase,
      warnings,
      meetsCandidateFloor: false,
      continuationReady: false,
    };
  }

  return {
    ...successBase,
    meetsCandidateFloor: true,
    continuationReady: true,
  };
}
