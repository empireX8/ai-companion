/**
 * CEQR-006 — Contradiction confidence policy contract tests.
 *
 * Pure module only. No Prisma. No network. No materialisation. No DB writes.
 * Model-reported confidence is not treated as a probability estimate.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR,
  CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN,
  CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN,
  CONTRADICTION_CONFIDENCE_POLICY_VERSION,
  calibrateContradictionConfidence,
  type ContradictionConfidenceCalibrationInput,
} from "../contradiction-confidence-calibration";

function baseValidInput(
  overrides: Partial<ContradictionConfidenceCalibrationInput> = {},
): ContradictionConfidenceCalibrationInput {
  return {
    modelReportedConfidence: 0.72,
    adjudicationOutcome: "semantic_accepted",
    deterministicValidationStatus: "valid",
    semanticPresent: true,
    semanticClassification: "clear_contradiction",
    refereeExecutionState: "completed",
    refereeOutcome: "PASS",
    refereeAdjustedConfidence: null,
    refereeValidationErrors: [],
    refereeContinuationAllowed: true,
    ...overrides,
  };
}

describe("CEQR-006 contradiction confidence policy", () => {
  describe("module boundary / non-persistence", () => {
    it("does not import Prisma, materialisation, or evidence-span writers", () => {
      const source = readFileSync(
        join(process.cwd(), "lib/contradiction-confidence-calibration.ts"),
        "utf8",
      );
      expect(source).not.toMatch(/from ["']@prisma\/client["']/);
      expect(source).not.toMatch(/prismadb/);
      expect(source).not.toMatch(/materializeContradictions/);
      expect(source).not.toMatch(/ensureEvidenceSpan/);
      expect(source).not.toMatch(/contradictionNode\.(create|update|upsert)/);
      expect(source).not.toMatch(/persistenceAuthorised:\s*true/);
      expect(source).not.toMatch(/persistable:\s*true/);
      expect(source).not.toMatch(/export function mapEffectiveConfidenceToStorageBand/);
    });

    it("pins an independent policy version", () => {
      expect(CONTRADICTION_CONFIDENCE_POLICY_VERSION).toBe(
        "contradiction-confidence-policy-v1",
      );
    });
  });

  describe("valid PASS", () => {
    it("accepts model-reported confidence, preserves inspectability, and never authorises persistence", () => {
      const result = calibrateContradictionConfidence(baseValidInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modelReportedConfidence).toBe(0.72);
      expect(result.effectiveConfidence).toBe(0.72);
      expect(result.effectiveConfidenceSource).toBe("model_reported");
      expect(result.recommendedStorageConfidence).toBe("medium");
      expect(result.meetsCandidateFloor).toBe(true);
      expect(result.refereeOutcome).toBe("PASS");
      expect(result.continuationReady).toBe(true);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
      expect(result.createCandidate).toBeUndefined();
      expect(result.persistenceDecision).toBeNull();
      expect(result.confidencePolicyVersion).toBe(
        CONTRADICTION_CONFIDENCE_POLICY_VERSION,
      );
    });

    it("does not silently promote PASS to high storage band", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 0.55 }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.recommendedStorageConfidence).toBe("medium");
      expect(result.effectiveConfidence).toBe(0.55);
      expect(result.continuationReady).toBe(true);
    });
  });

  describe("optional adjustment under PASS", () => {
    it("applies a valid strictly lower optional adjustment as effective score", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.9,
          refereeAdjustedConfidence: 0.7,
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modelReportedConfidence).toBe(0.9);
      expect(result.effectiveConfidence).toBe(0.7);
      expect(result.effectiveConfidenceSource).toBe("referee_adjusted_optional");
      expect(result.recommendedStorageConfidence).toBe("medium");
      expect(result.meetsCandidateFloor).toBe(true);
      expect(result.continuationReady).toBe(true);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });

    it("fails closed on optional increase", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.6,
          refereeAdjustedConfidence: 0.8,
        }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("optional_pass_adjustment_increase_forbidden");
      expect(result.continuationReady).toBe(false);
      expect(result.persistable).toBe(false);
    });

    it("fails closed on optional equality (explicit: not a valid lowering)", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.6,
          refereeAdjustedConfidence: 0.6,
        }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("optional_pass_adjustment_not_strictly_lower");
    });

    it("fails closed on optional NaN / out-of-range adjustment", () => {
      expect(
        calibrateContradictionConfidence(
          baseValidInput({ refereeAdjustedConfidence: Number.NaN }),
        ).ok,
      ).toBe(false);
      expect(
        calibrateContradictionConfidence(
          baseValidInput({ refereeAdjustedConfidence: 1.2 }),
        ).ok,
      ).toBe(false);
      expect(
        calibrateContradictionConfidence(
          baseValidInput({ refereeAdjustedConfidence: -0.1 }),
        ).ok,
      ).toBe(false);
    });
  });

  describe("PASS_WITH_LOWER_CONFIDENCE", () => {
    it("uses the strictly lower score for band and floor; keeps model score inspectable", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.9,
          refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
          refereeAdjustedConfidence: 0.45,
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modelReportedConfidence).toBe(0.9);
      expect(result.effectiveConfidence).toBe(0.45);
      expect(result.effectiveConfidenceSource).toBe("referee_adjusted_required");
      expect(result.recommendedStorageConfidence).toBe("low");
      expect(result.meetsCandidateFloor).toBe(false);
      expect(result.continuationReady).toBe(false);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });

    it("referee-lowered score crossing above-to-below floor is inspectable but not continuation-ready", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.8,
          refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
          refereeAdjustedConfidence: 0.49,
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modelReportedConfidence).toBe(0.8);
      expect(result.effectiveConfidence).toBe(0.49);
      expect(result.recommendedStorageConfidence).toBe("low");
      expect(result.meetsCandidateFloor).toBe(false);
      expect(result.continuationReady).toBe(false);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });

    it("fails closed when adjustment is missing, equal, greater, or malformed", () => {
      expect(
        calibrateContradictionConfidence(
          baseValidInput({
            refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
            refereeAdjustedConfidence: null,
          }),
        ).ok,
      ).toBe(false);

      const equal = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.7,
          refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
          refereeAdjustedConfidence: 0.7,
        }),
      );
      expect(equal.ok).toBe(false);
      if (!equal.ok) {
        expect(equal.code).toBe("adjusted_confidence_not_strictly_lower");
      }

      const greater = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: 0.7,
          refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
          refereeAdjustedConfidence: 0.8,
        }),
      );
      expect(greater.ok).toBe(false);

      const malformed = calibrateContradictionConfidence(
        baseValidInput({
          refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
          refereeAdjustedConfidence: Number.POSITIVE_INFINITY,
        }),
      );
      expect(malformed.ok).toBe(false);
    });
  });

  describe("blocking referee states and outcomes", () => {
    it.each([
      ["ROUTE_TO_DIFFERENT_OBJECT_TYPE", "referee_continuation_blocked"],
      ["REQUEST_MORE_EVIDENCE", "referee_continuation_blocked"],
      ["ABSTAIN", "referee_continuation_blocked"],
    ] as const)("blocks outcome %s", (outcome, code) => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ refereeOutcome: outcome }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(code);
      expect(result.recommendedStorageConfidence).toBeNull();
      expect(result.persistable).toBe(false);
    });

    it.each([
      ["not_run", "referee_not_run"],
      ["failed", "referee_failed"],
      ["invalid_evaluation", "referee_invalid_evaluation"],
    ] as const)("blocks execution state %s", (state, code) => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeExecutionState: state,
          refereeOutcome: null,
          refereeContinuationAllowed: false,
        }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(code);
    });
  });

  describe("validated referee gate evidence is mandatory", () => {
    it("fails closed when refereeContinuationAllowed is omitted", () => {
      const { refereeContinuationAllowed: _omit, ...rest } = baseValidInput();
      void _omit;
      const result = calibrateContradictionConfidence(
        rest as ContradictionConfidenceCalibrationInput,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_continuation_evidence_missing");
      }
    });

    it("fails closed when refereeContinuationAllowed is undefined", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeContinuationAllowed: undefined as unknown as boolean,
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_continuation_evidence_missing");
      }
    });

    it("fails closed when refereeContinuationAllowed is null", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeContinuationAllowed: null as unknown as boolean,
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_continuation_evidence_missing");
      }
    });

    it("fails closed when refereeContinuationAllowed is false", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ refereeContinuationAllowed: false }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_continuation_blocked");
      }
    });

    it("fails closed when refereeValidationErrors is omitted", () => {
      const { refereeValidationErrors: _omit, ...rest } = baseValidInput();
      void _omit;
      const result = calibrateContradictionConfidence(
        rest as ContradictionConfidenceCalibrationInput,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_validation_errors_missing");
      }
    });

    it("fails closed when refereeValidationErrors is non-array", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeValidationErrors: "ok" as unknown as readonly string[],
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_validation_errors_malformed");
      }
    });

    it("fails closed when refereeValidationErrors is a non-empty array", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeValidationErrors: ["referee_evaluation_blank_rationale"],
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("referee_invalid_evaluation");
      }
    });

    it("continues normally when continuationAllowed is true and validationErrors is empty", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          refereeContinuationAllowed: true,
          refereeValidationErrors: [],
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.continuationReady).toBe(true);
      expect(result.meetsCandidateFloor).toBe(true);
    });
  });

  describe("invalid numeric confidence", () => {
    it.each([
      [Number.NaN, "model_confidence_non_finite"],
      [Number.POSITIVE_INFINITY, "model_confidence_non_finite"],
      [-0.01, "model_confidence_out_of_range"],
      [1.01, "model_confidence_out_of_range"],
      [null, "model_confidence_missing"],
      [undefined, "model_confidence_missing"],
    ] as const)("fails closed for model confidence %s", (value, code) => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: value as never }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(code);
    });
  });

  describe("semantic gates", () => {
    it("blocks non-Class-A classification", () => {
      for (const classification of [
        "plausible_unresolved_tension",
        "compatible_states",
        "insufficient_or_misaligned_context",
      ] as const) {
        const result = calibrateContradictionConfidence(
          baseValidInput({ semanticClassification: classification }),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("classification_not_clear_contradiction");
        }
      }
    });

    it("blocks missing semantic payload", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({
          semanticPresent: false,
          semanticClassification: null,
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("semantic_payload_missing");
    });

    it("blocks invalid deterministic validation", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ deterministicValidationStatus: "invalid" }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("deterministic_validation_invalid");
      }
    });

    it("blocks non-semantic_accepted adjudication", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ adjudicationOutcome: "abstained" }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("adjudication_not_semantic_accepted");
      }
    });
  });

  describe("threshold boundaries via calibrateContradictionConfidence", () => {
    it("maps storage bands at exact boundaries through the public entry point", () => {
      const zero = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 0 }),
      );
      expect(zero.ok).toBe(true);
      if (zero.ok) {
        expect(zero.recommendedStorageConfidence).toBe("low");
        expect(zero.continuationReady).toBe(false);
      }

      const justBelowMedium = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence:
            CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN - 0.01,
        }),
      );
      expect(justBelowMedium.ok).toBe(true);
      if (justBelowMedium.ok) {
        expect(justBelowMedium.recommendedStorageConfidence).toBe("low");
      }

      const exactlyMedium = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_MEDIUM_MIN,
        }),
      );
      expect(exactlyMedium.ok).toBe(true);
      if (exactlyMedium.ok) {
        expect(exactlyMedium.recommendedStorageConfidence).toBe("medium");
        expect(exactlyMedium.continuationReady).toBe(true);
      }

      const justBelowHigh = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN - 0.01,
        }),
      );
      expect(justBelowHigh.ok).toBe(true);
      if (justBelowHigh.ok) {
        expect(justBelowHigh.recommendedStorageConfidence).toBe("medium");
      }

      const exactlyHigh = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN,
        }),
      );
      expect(exactlyHigh.ok).toBe(true);
      if (exactlyHigh.ok) {
        expect(exactlyHigh.recommendedStorageConfidence).toBe("high");
      }

      const one = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 1 }),
      );
      expect(one.ok).toBe(true);
      if (one.ok) {
        expect(one.recommendedStorageConfidence).toBe("high");
      }
    });

    it("0.49 is successful, low-band, below floor, not continuation-ready", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 0.49 }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.recommendedStorageConfidence).toBe("low");
      expect(result.meetsCandidateFloor).toBe(false);
      expect(result.continuationReady).toBe(false);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });

    it("0.50 is successful, medium-band, meets floor, continuation-ready", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 0.5 }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.recommendedStorageConfidence).toBe("medium");
      expect(result.meetsCandidateFloor).toBe(true);
      expect(result.continuationReady).toBe(true);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });

    it("tests candidate floor immediately below, equal, and above", () => {
      const below = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR - 0.01,
        }),
      );
      expect(below.ok).toBe(true);
      if (below.ok) {
        expect(below.meetsCandidateFloor).toBe(false);
        expect(below.recommendedStorageConfidence).toBe("low");
        expect(below.continuationReady).toBe(false);
        expect(below.persistable).toBe(false);
      }

      const equal = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR,
        }),
      );
      expect(equal.ok).toBe(true);
      if (equal.ok) {
        expect(equal.meetsCandidateFloor).toBe(true);
        expect(equal.recommendedStorageConfidence).toBe("medium");
        expect(equal.continuationReady).toBe(true);
      }

      const above = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CANDIDATE_CONFIDENCE_FLOOR + 0.01,
        }),
      );
      expect(above.ok).toBe(true);
      if (above.ok) {
        expect(above.meetsCandidateFloor).toBe(true);
        expect(above.recommendedStorageConfidence).toBe("medium");
        expect(above.continuationReady).toBe(true);
      }
    });

    it("tests high-band boundary immediately below, equal, and above", () => {
      const below = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN - 0.01,
        }),
      );
      expect(below.ok).toBe(true);
      if (below.ok) expect(below.recommendedStorageConfidence).toBe("medium");

      const equal = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN,
        }),
      );
      expect(equal.ok).toBe(true);
      if (equal.ok) expect(equal.recommendedStorageConfidence).toBe("high");

      const above = calibrateContradictionConfidence(
        baseValidInput({
          modelReportedConfidence: CONTRADICTION_CONFIDENCE_BAND_HIGH_MIN + 0.01,
        }),
      );
      expect(above.ok).toBe(true);
      if (above.ok) expect(above.recommendedStorageConfidence).toBe("high");
    });
  });

  describe("anti-regression: forbidden signals must not change result", () => {
    it("identical model/referee inputs yield identical results regardless of type/marker/category labels", () => {
      const core = baseValidInput({ modelReportedConfidence: 0.66 });
      const a = calibrateContradictionConfidence(core);
      const b = calibrateContradictionConfidence({
        ...core,
        // These fields are intentionally absent from the policy input; prove
        // that surrounding metadata cannot be smuggled in via extra keys.
        ...({
          contradictionType: "goal_behavior_gap",
          markerFamily: "goal_mismatch",
          referenceItemType: "goal",
          tokenOverlap: 0.99,
          rhetoricalMarker: "but i",
          sideACategory: "goal",
          sideBCategory: "behaviour",
        } as object),
      } as ContradictionConfidenceCalibrationInput);
      const c = calibrateContradictionConfidence({
        ...core,
        ...({
          contradictionType: "constraint_conflict",
          markerFamily: "constraint_violation",
          referenceItemType: "constraint",
          tokenOverlap: 0.01,
          rhetoricalMarker: "however i",
          sideACategory: "constraint",
          sideBCategory: "violation",
        } as object),
      } as ContradictionConfidenceCalibrationInput);

      expect(a).toEqual(b);
      expect(a).toEqual(c);
      expect(a.ok).toBe(true);
      if (a.ok) {
        expect(a.effectiveConfidence).toBe(0.66);
        expect(a.recommendedStorageConfidence).toBe("medium");
        expect(a.continuationReady).toBe(true);
      }
    });
  });

  describe("below-floor decision", () => {
    it("treats valid below-floor scores as successful evaluations that are not continuation-ready", () => {
      const result = calibrateContradictionConfidence(
        baseValidInput({ modelReportedConfidence: 0.2 }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.meetsCandidateFloor).toBe(false);
      expect(result.continuationReady).toBe(false);
      expect(result.recommendedStorageConfidence).toBe("low");
      expect(
        result.warnings.some((w) => w.startsWith("below_candidate_floor")),
      ).toBe(true);
      expect(result.persistable).toBe(false);
      expect(result.persistenceAuthorised).toBe(false);
    });
  });
});
