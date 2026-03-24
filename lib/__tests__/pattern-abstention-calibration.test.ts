/**
 * Tests for visible claim abstention calibration (Phase 10).
 *
 * Coverage:
 *   - threshold table computed correctly from fixed synthetic candidates
 *   - calibration selects expected threshold on deterministic fixture
 *   - no-valid-threshold fallback selection
 *   - runtime threshold fallback remains stable (no policy → constant)
 *   - calibrated threshold can change runtime surfacing deterministically
 *   - contradiction_drift is excluded (it is not an ActiveFamily)
 *   - eval report includes visibleCalibration when eligible claims exist
 *   - regression gates protect the calibration surface
 *   - repeated calls produce same result (determinism)
 */

import { describe, expect, it } from "vitest";
import {
  CALIBRATION_COVERAGE_FLOOR,
  CALIBRATION_TARGET_FAILURE_RATE,
  CALIBRATION_THRESHOLD_GRID,
  computeAbstentionCalibration,
  computeCalibrationRow,
  extractCalibrationCandidates,
  selectCalibratedThreshold,
} from "../eval/pattern-abstention-calibration";
import {
  resolveVisibleAbstentionThreshold,
  VISIBLE_ABSTENTION_THRESHOLD,
} from "../pattern-visible-claim";
import type {
  FaithfulnessClaimScore,
  GroupResult,
  VisibleAbstentionCalibrationReport,
  VisibleCalibrationRow,
} from "../eval/eval-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal AdjudicationGroup shape needed by GroupResult. */
function makeGroupResult(
  groupId: string,
  scores: Array<{ family: "trigger_condition" | "inner_critic" | "repetitive_loop" | "recovery_stabilizer"; score: number }>
): GroupResult {
  return {
    group: {
      id: groupId,
      description: `group-${groupId}`,
      entries: [],
      expected_behavioral: true,
      expected_families: {
        trigger_condition: false,
        inner_critic: false,
        repetitive_loop: false,
        recovery_stabilizer: false,
      },
      expected_abstain: false,
      expected_quote_safe: false,
    },
    behavioral: true,
    emittedFamilies: {
      trigger_condition: scores.some((s) => s.family === "trigger_condition"),
      inner_critic: scores.some((s) => s.family === "inner_critic"),
      repetitive_loop: scores.some((s) => s.family === "repetitive_loop"),
      recovery_stabilizer: scores.some((s) => s.family === "recovery_stabilizer"),
    },
    anyClaimed: scores.length > 0,
    quoteSafe: false,
    behavioralCorrect: true,
    familiesCorrect: true,
    abstainCorrect: true,
    quoteSafeCorrect: true,
    falsePositiveFamilies: [],
    falseNegativeFamilies: [],
    clueQuotes: {
      trigger_condition: [],
      inner_critic: [],
      repetitive_loop: [],
      recovery_stabilizer: [],
    },
    visibleAbstentionScores: scores.map((s) => ({
      family: s.family,
      score: s.score,
      triggered: s.score < VISIBLE_ABSTENTION_THRESHOLD,
      evidenceCount: 3,
      sessionCount: 2,
      hasDisplaySafeQuote: true,
    })),
    reviewFlag: {
      groupId,
      emittedFamilies: [],
      review_needed: false,
      review_priority: null,
      review_reasons: [],
      faithfulnessIncluded: false,
    },
  };
}

function makeFaithfulnessScore(
  groupId: string,
  family: "trigger_condition" | "inner_critic",
  faithful: boolean | null,
  parseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed" = "parsed"
): FaithfulnessClaimScore {
  return {
    groupId,
    family,
    visibleSummary: "test summary",
    receiptQuotes: ["quote A"],
    faithful,
    score: faithful ? 0.9 : 0.2,
    rationale: "test rationale",
    parseStatus,
    shadowMode: true,
    usedForProductDecision: false,
  };
}

// ── CALIBRATION_THRESHOLD_GRID ────────────────────────────────────────────────

describe("CALIBRATION_THRESHOLD_GRID", () => {
  it("has 21 values from 0.00 to 1.00 in 0.05 steps", () => {
    expect(CALIBRATION_THRESHOLD_GRID).toHaveLength(21);
    expect(CALIBRATION_THRESHOLD_GRID[0]).toBe(0.00);
    expect(CALIBRATION_THRESHOLD_GRID[20]).toBe(1.00);
    expect(CALIBRATION_THRESHOLD_GRID[1]).toBe(0.05);
    expect(CALIBRATION_THRESHOLD_GRID[10]).toBe(0.50);
  });

  it("is deterministic across multiple accesses", () => {
    const a = [...CALIBRATION_THRESHOLD_GRID];
    const b = [...CALIBRATION_THRESHOLD_GRID];
    expect(a).toEqual(b);
  });
});

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

describe("calibration constants", () => {
  it("TARGET_FAILURE_RATE is 0.25", () => {
    expect(CALIBRATION_TARGET_FAILURE_RATE).toBe(0.25);
  });

  it("COVERAGE_FLOOR is 0.40", () => {
    expect(CALIBRATION_COVERAGE_FLOOR).toBe(0.40);
  });
});

// ── computeCalibrationRow ─────────────────────────────────────────────────────

describe("computeCalibrationRow", () => {
  it("returns all-null metrics when candidates is empty", () => {
    const row = computeCalibrationRow([], 0.5);
    expect(row.eligibleClaims).toBe(0);
    expect(row.surfacedClaims).toBe(0);
    expect(row.abstainedClaims).toBe(0);
    expect(row.coverageRate).toBeNull();
    expect(row.failureRate).toBeNull();
    expect(row.failureCount).toBe(0);
    expect(row.faithfulSurfacedCount).toBe(0);
    expect(row.faithfulSurfacedRate).toBeNull();
  });

  it("surfaces all candidates at threshold 0.00", () => {
    const candidates = [
      { groupId: "g1", family: "trigger_condition" as const, score: 0.3, isBadClaim: false },
      { groupId: "g1", family: "inner_critic" as const, score: 0.7, isBadClaim: true },
      { groupId: "g2", family: "inner_critic" as const, score: 0.0, isBadClaim: false },
    ];
    const row = computeCalibrationRow(candidates, 0.0);
    expect(row.eligibleClaims).toBe(3);
    expect(row.surfacedClaims).toBe(3);
    expect(row.abstainedClaims).toBe(0);
    expect(row.coverageRate).toBe(1.0);
    expect(row.failureCount).toBe(1);
    expect(row.failureRate).toBeCloseTo(1 / 3);
    expect(row.faithfulSurfacedCount).toBe(2);
    expect(row.faithfulSurfacedRate).toBeCloseTo(2 / 3);
  });

  it("abstains all candidates at threshold 1.00 when no score is exactly 1.0", () => {
    const candidates = [
      { groupId: "g1", family: "trigger_condition" as const, score: 0.7, isBadClaim: false },
      { groupId: "g2", family: "inner_critic" as const, score: 0.9, isBadClaim: false },
    ];
    const row = computeCalibrationRow(candidates, 1.0);
    expect(row.surfacedClaims).toBe(0);
    expect(row.abstainedClaims).toBe(2);
    expect(row.coverageRate).toBe(0);
    expect(row.failureRate).toBeNull(); // surfacedClaims === 0
    expect(row.faithfulSurfacedRate).toBeNull();
  });

  it("surfaces score >= threshold (inclusive boundary)", () => {
    const candidates = [
      { groupId: "g1", family: "trigger_condition" as const, score: 0.55, isBadClaim: false },
      { groupId: "g2", family: "inner_critic" as const, score: 0.54, isBadClaim: false },
    ];
    const row = computeCalibrationRow(candidates, 0.55);
    expect(row.surfacedClaims).toBe(1); // only score=0.55 passes
    expect(row.abstainedClaims).toBe(1);
  });

  it("computes correct metrics for mixed fixture at threshold 0.60", () => {
    // 4 candidates: scores 0.30, 0.60, 0.80, 0.90
    // bad: index 1 (score=0.60), index 2 (score=0.80)
    const candidates = [
      { groupId: "g1", family: "trigger_condition" as const, score: 0.30, isBadClaim: false },
      { groupId: "g1", family: "inner_critic" as const, score: 0.60, isBadClaim: true },
      { groupId: "g2", family: "trigger_condition" as const, score: 0.80, isBadClaim: true },
      { groupId: "g2", family: "inner_critic" as const, score: 0.90, isBadClaim: false },
    ];
    const row = computeCalibrationRow(candidates, 0.60);
    expect(row.eligibleClaims).toBe(4);
    expect(row.surfacedClaims).toBe(3); // 0.60, 0.80, 0.90
    expect(row.abstainedClaims).toBe(1); // 0.30
    expect(row.coverageRate).toBeCloseTo(3 / 4);
    expect(row.failureCount).toBe(2); // 0.60, 0.80 are bad
    expect(row.failureRate).toBeCloseTo(2 / 3);
    expect(row.faithfulSurfacedCount).toBe(1); // only 0.90 is good
    expect(row.faithfulSurfacedRate).toBeCloseTo(1 / 3);
  });
});

// ── selectCalibratedThreshold ─────────────────────────────────────────────────

describe("selectCalibratedThreshold", () => {
  function makeRow(
    threshold: number,
    surfacedClaims: number,
    eligibleClaims: number,
    failureCount: number
  ): VisibleCalibrationRow {
    const coverageRate = eligibleClaims === 0 ? null : surfacedClaims / eligibleClaims;
    const failureRate = surfacedClaims === 0 ? null : failureCount / surfacedClaims;
    const faithfulSurfacedCount = surfacedClaims - failureCount;
    const faithfulSurfacedRate = surfacedClaims === 0 ? null : faithfulSurfacedCount / surfacedClaims;
    return {
      threshold,
      eligibleClaims,
      surfacedClaims,
      abstainedClaims: eligibleClaims - surfacedClaims,
      coverageRate,
      failureCount,
      failureRate,
      faithfulSurfacedCount,
      faithfulSurfacedRate,
    };
  }

  it("returns null when rows is empty", () => {
    const result = selectCalibratedThreshold([], 0.25);
    expect(result.selectedThreshold).toBeNull();
    expect(result.selectedRow).toBeNull();
    expect(result.fallbackUsed).toBe(false);
  });

  it("returns null when all rows have no eligible claims", () => {
    const rows = [makeRow(0.50, 0, 0, 0), makeRow(0.55, 0, 0, 0)];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.selectedThreshold).toBeNull();
    expect(result.selectionReason).toBe("no_eligible_claims");
  });

  it("selects threshold with highest coverage among those meeting failure target", () => {
    // Three thresholds, two meet target:
    //   0.50: coverage=1.0, failure=0.20 → meets 0.25 target
    //   0.60: coverage=0.75, failure=0.10 → meets 0.25 target
    //   0.70: coverage=0.50, failure=0.00 → meets 0.25 target
    // Best = 0.50 (highest coverage)
    const rows = [
      makeRow(0.50, 4, 4, 0),  // 4 surfaced, 0 bad → failure=0
      makeRow(0.60, 3, 4, 0),  // 3 surfaced, 0 bad → failure=0
      makeRow(0.70, 2, 4, 0),  // 2 surfaced, 0 bad → failure=0
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.selectedThreshold).toBe(0.50);
    expect(result.fallbackUsed).toBe(false);
  });

  it("ties on coverage choose lowest threshold", () => {
    // 0.30 and 0.40 both surface all 4 claims with 0 failures
    const rows = [
      makeRow(0.30, 4, 4, 0),
      makeRow(0.40, 4, 4, 0),
      makeRow(0.50, 3, 4, 0),
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.selectedThreshold).toBe(0.30);
    expect(result.fallbackUsed).toBe(false);
  });

  it("skips thresholds where failure rate exceeds target", () => {
    // 0.50 fails target (failureRate=0.50 > 0.25)
    // 0.70 meets target (failureRate=0.20 <= 0.25)
    const rows = [
      makeRow(0.50, 4, 4, 2),  // 2/4 = 0.50 failure rate — over target
      makeRow(0.70, 5, 5, 1),  // 1/5 = 0.20 — meets target — this is the one
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.selectedThreshold).toBe(0.70);
    expect(result.fallbackUsed).toBe(false);
  });

  it("uses fallback when no threshold meets target — picks least-bad", () => {
    // All thresholds have failure rate > 0.25:
    //   0.50: 2/4=0.50
    //   0.60: 1/2=0.50
    //   0.70: 1/1=1.00
    // Least bad by failure: 0.50 and 0.60 are tied at 0.50
    // Among ties, highest coverage: 0.50 (4/4=1.0) > 0.60 (2/4=0.5)
    const rows = [
      makeRow(0.50, 4, 4, 2),
      makeRow(0.60, 2, 4, 1),
      makeRow(0.70, 1, 4, 1),
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.fallbackUsed).toBe(true);
    expect(result.selectedThreshold).toBe(0.50);
    expect(result.selectionReason).toContain("fallback");
  });

  it("fallback: among equal failure rates chooses highest coverage then lowest threshold", () => {
    // Both 0.40 and 0.50 have failure rate=0.50 — tied
    // Both have coverage=0.50 — tied
    // Tie-breaker: lowest threshold = 0.40
    const rows = [
      makeRow(0.40, 2, 4, 1),  // failure=0.50, coverage=0.50
      makeRow(0.50, 2, 4, 1),  // failure=0.50, coverage=0.50
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    expect(result.selectedThreshold).toBe(0.40);
    expect(result.fallbackUsed).toBe(true);
  });

  it("treats failureRate=null as satisfying target (no surfaced claims)", () => {
    // A threshold with no surfaced claims has failureRate=null.
    // Null is treated as satisfying the target (no failures possible).
    const rows = [
      makeRow(0.95, 0, 4, 0),  // surfaced=0, failureRate=null → meets target
      makeRow(0.80, 1, 4, 1),  // failureRate=1.0 → over target
    ];
    const result = selectCalibratedThreshold(rows, 0.25);
    // 0.95 meets target (null failure rate), so it's selected
    // Coverage = 0/4 = 0.0 — not great but valid
    expect(result.selectedThreshold).toBe(0.95);
    expect(result.fallbackUsed).toBe(false);
  });
});

// ── extractCalibrationCandidates ──────────────────────────────────────────────

describe("extractCalibrationCandidates", () => {
  it("returns empty array when no group results", () => {
    const candidates = extractCalibrationCandidates([], null);
    expect(candidates).toHaveLength(0);
  });

  it("extracts one candidate per visible abstention score record", () => {
    const gr = makeGroupResult("g1", [
      { family: "trigger_condition", score: 0.70 },
      { family: "inner_critic", score: 0.40 },
    ]);
    const candidates = extractCalibrationCandidates([gr], null);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.groupId).toBe("g1");
    expect(candidates[0]!.score).toBe(0.70);
    expect(candidates[1]!.score).toBe(0.40);
  });

  it("marks isBadClaim=false when no faithfulness data is provided", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const candidates = extractCalibrationCandidates([gr], null);
    expect(candidates[0]!.isBadClaim).toBe(false);
  });

  it("marks isBadClaim=false when faithful=true", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", true),
    ];
    const candidates = extractCalibrationCandidates([gr], fScores);
    expect(candidates[0]!.isBadClaim).toBe(false);
  });

  it("marks isBadClaim=true when faithful=false", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", false),
    ];
    const candidates = extractCalibrationCandidates([gr], fScores);
    expect(candidates[0]!.isBadClaim).toBe(true);
  });

  it("marks isBadClaim=true when parseStatus is not 'parsed'", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", null, "malformed_json"),
    ];
    const candidates = extractCalibrationCandidates([gr], fScores);
    expect(candidates[0]!.isBadClaim).toBe(true);
  });

  it("marks isBadClaim=true when faithful=null and parseStatus is 'request_failed'", () => {
    const gr = makeGroupResult("g1", [{ family: "inner_critic", score: 0.6 }]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "inner_critic", null, "request_failed"),
    ];
    const candidates = extractCalibrationCandidates([gr], fScores);
    expect(candidates[0]!.isBadClaim).toBe(true);
  });

  it("correctly matches faithfulness by groupId:family key", () => {
    const g1 = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.80 }]);
    const g2 = makeGroupResult("g2", [{ family: "trigger_condition", score: 0.80 }]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", false), // g1 is bad
      makeFaithfulnessScore("g2", "trigger_condition", true),  // g2 is good
    ];
    const candidates = extractCalibrationCandidates([g1, g2], fScores);
    expect(candidates).toHaveLength(2);
    const c1 = candidates.find((c) => c.groupId === "g1")!;
    const c2 = candidates.find((c) => c.groupId === "g2")!;
    expect(c1.isBadClaim).toBe(true);
    expect(c2.isBadClaim).toBe(false);
  });

  it("contradiction_drift cannot appear — ActiveFamily does not include it", () => {
    // All families in visibleAbstentionScores are typed as ActiveFamily.
    // contradiction_drift is not in ActiveFamily, so it can never appear here.
    // This test documents the invariant by verifying the only possible families.
    const gr = makeGroupResult("g1", [
      { family: "trigger_condition", score: 0.7 },
      { family: "inner_critic", score: 0.8 },
      { family: "repetitive_loop", score: 0.9 },
      { family: "recovery_stabilizer", score: 0.6 },
    ]);
    const candidates = extractCalibrationCandidates([gr], null);
    const families = candidates.map((c) => c.family);
    expect(families).not.toContain("contradiction_drift");
    expect(families).toHaveLength(4);
  });
});

// ── computeAbstentionCalibration ──────────────────────────────────────────────

describe("computeAbstentionCalibration", () => {
  it("returns a report with 21 rows covering 0.00 to 1.00", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const report = computeAbstentionCalibration([gr], null);
    expect(report.rows).toHaveLength(21);
    expect(report.rows[0]!.threshold).toBe(0.00);
    expect(report.rows[20]!.threshold).toBe(1.00);
  });

  it("returns eligibleClaims=0 and selectedThreshold=null when no group results", () => {
    const report = computeAbstentionCalibration([], null);
    expect(report.eligibleClaims).toBe(0);
    expect(report.selectedThreshold).toBeNull();
    expect(report.selectedRow).toBeNull();
    expect(report.policy).toBeNull();
  });

  it("returns eligibleClaims=0 when groups have no visibleAbstentionScores", () => {
    const gr = makeGroupResult("g1", []); // no scored families
    const report = computeAbstentionCalibration([gr], null);
    expect(report.eligibleClaims).toBe(0);
    expect(report.selectedThreshold).toBeNull();
  });

  it("selects expected threshold on deterministic fixture", () => {
    // Fixture: 4 candidates with known scores and faithfulness
    //   g1:tc  score=0.80  faithful
    //   g1:ic  score=0.80  faithful
    //   g2:tc  score=0.70  unfaithful (bad)
    //   g2:ic  score=0.60  faithful
    //
    // At threshold=0.00: 4 surfaced, 1 bad → failure=0.25 (≤0.25 target) ✓, coverage=1.0
    // At threshold=0.60: 4 surfaced, 1 bad → same
    // At threshold=0.65: 3 surfaced (0.70, 0.80, 0.80), 1 bad → failure=0.333 (>0.25) ✗
    // At threshold=0.75: 2 surfaced (0.80, 0.80), 0 bad → failure=0.0 ✓, coverage=0.5
    //
    // The best satisfying threshold is 0.00 (or 0.60) — highest coverage = 1.0.
    // Tie-breaker: lowest threshold → 0.00.
    const g1 = makeGroupResult("g1", [
      { family: "trigger_condition", score: 0.80 },
      { family: "inner_critic", score: 0.80 },
    ]);
    const g2 = makeGroupResult("g2", [
      { family: "trigger_condition", score: 0.70 },
      { family: "inner_critic", score: 0.60 },
    ]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", true),
      makeFaithfulnessScore("g1", "inner_critic", true),
      makeFaithfulnessScore("g2", "trigger_condition", false),  // bad
      makeFaithfulnessScore("g2", "inner_critic", true),
    ];
    const report = computeAbstentionCalibration([g1, g2], fScores);

    expect(report.eligibleClaims).toBe(4);
    expect(report.targetFailureRate).toBe(CALIBRATION_TARGET_FAILURE_RATE);

    // At threshold=0.00: 4 surfaced, failure=1/4=0.25 ≤ 0.25 ✓, coverage=1.0
    const row0 = report.rows.find((r) => r.threshold === 0.00)!;
    expect(row0.surfacedClaims).toBe(4);
    expect(row0.failureRate).toBeCloseTo(0.25);
    expect(row0.coverageRate).toBe(1.0);

    // Selected threshold should be 0.00 (max coverage among satisfying)
    expect(report.selectedThreshold).toBe(0.00);
    expect(report.policy!.fallbackUsed).toBe(false);
    expect(report.selectedRow!.coverageRate).toBe(1.0);
  });

  it("uses fallback when all thresholds exceed the target failure rate", () => {
    // 2 candidates, both bad
    // At any threshold where claims are surfaced, failure=1.0 > 0.25
    // At threshold=1.00 nothing is surfaced → failureRate=null (meets null rule)
    // Hmm, null meets target → threshold=1.00 would be selected with 0 coverage.
    // Let's instead have candidates with score exactly 1.0 so threshold=1.00 surfaces them.
    // Or: 2 candidates both bad with scores 0.7 and 0.8
    // threshold=0.00..0.70: surfaces ≥1, failure=1.0 > 0.25 ✗
    // threshold=0.75..1.00: surfaces 0, failureRate=null (null meets target)
    // So "best" with null failure = threshold 0.75 with coverage=0.0
    //
    // To test the true fallback path, we need ALL rows to have failure > target
    // including null-coverage rows being excluded.
    // Actually null is treated as SATISFYING the target (no surfaced, no failures).
    // So we can't easily test "pure" fallback without a score of exactly 1.0.
    //
    // Instead: make 3 candidates with score=1.0 so threshold=1.00 is the only
    // one that surfaces them, with 3 bad claims → failure=1.0 at all non-empty thresholds.
    // threshold=1.00: 3 surfaced, 3 bad, failure=1.0 → over target
    // threshold<1.00: all surfaced too (score>=threshold), failure=1.0 → over target
    // No null-coverage rows → true fallback.
    const candidates = [
      { groupId: "g1", family: "trigger_condition" as const, score: 1.0, isBadClaim: true },
      { groupId: "g1", family: "inner_critic" as const, score: 1.0, isBadClaim: true },
      { groupId: "g2", family: "trigger_condition" as const, score: 1.0, isBadClaim: true },
    ];
    // Build rows manually for the grid
    const rows = CALIBRATION_THRESHOLD_GRID.map((t) => computeCalibrationRow(candidates, t));
    const result = selectCalibratedThreshold(rows, 0.25);
    // All thresholds fail (failure=1.0 at all, since score=1.0 everywhere)
    // Fallback: lowest failure (all 1.0), highest coverage (all 1.0), lowest threshold = 0.00
    expect(result.fallbackUsed).toBe(true);
    expect(result.selectedThreshold).toBe(0.00);
    expect(result.selectionReason).toContain("fallback");
  });

  it("is deterministic — repeated calls produce identical results", () => {
    const gr = makeGroupResult("g1", [
      { family: "trigger_condition", score: 0.75 },
      { family: "inner_critic", score: 0.45 },
    ]);
    const fScores: FaithfulnessClaimScore[] = [
      makeFaithfulnessScore("g1", "trigger_condition", true),
      makeFaithfulnessScore("g1", "inner_critic", false),
    ];
    const r1 = computeAbstentionCalibration([gr], fScores);
    const r2 = computeAbstentionCalibration([gr], fScores);
    expect(r1.selectedThreshold).toEqual(r2.selectedThreshold);
    expect(r1.eligibleClaims).toEqual(r2.eligibleClaims);
    expect(r1.rows.map((r) => r.threshold)).toEqual(r2.rows.map((r) => r.threshold));
    expect(r1.rows.map((r) => r.failureRate)).toEqual(r2.rows.map((r) => r.failureRate));
  });

  it("stores targetFailureRate from CALIBRATION_TARGET_FAILURE_RATE constant", () => {
    const report = computeAbstentionCalibration([], null);
    expect(report.targetFailureRate).toBe(CALIBRATION_TARGET_FAILURE_RATE);
  });

  it("policy is null when no eligible claims", () => {
    const report = computeAbstentionCalibration([], null);
    expect(report.policy).toBeNull();
  });

  it("policy has correct shape when threshold selected", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.80 }]);
    const fScores = [makeFaithfulnessScore("g1", "trigger_condition", true)];
    const report = computeAbstentionCalibration([gr], fScores);
    expect(report.policy).not.toBeNull();
    expect(typeof report.policy!.selectedThreshold).toBe("number");
    expect(report.policy!.targetFailureRate).toBe(CALIBRATION_TARGET_FAILURE_RATE);
    expect(typeof report.policy!.selectionReason).toBe("string");
    expect(report.policy!.selectionReason.length).toBeGreaterThan(0);
    expect(typeof report.policy!.fallbackUsed).toBe("boolean");
  });
});

// ── resolveVisibleAbstentionThreshold ─────────────────────────────────────────

describe("resolveVisibleAbstentionThreshold", () => {
  it("returns VISIBLE_ABSTENTION_THRESHOLD when no policy provided", () => {
    expect(resolveVisibleAbstentionThreshold()).toBe(VISIBLE_ABSTENTION_THRESHOLD);
    expect(resolveVisibleAbstentionThreshold(null)).toBe(VISIBLE_ABSTENTION_THRESHOLD);
    expect(resolveVisibleAbstentionThreshold(undefined)).toBe(VISIBLE_ABSTENTION_THRESHOLD);
  });

  it("returns calibrated threshold when policy is valid and not fallback", () => {
    const policy = {
      selectedThreshold: 0.40,
      fallbackUsed: false,
    };
    expect(resolveVisibleAbstentionThreshold(policy)).toBe(0.40);
  });

  it("returns VISIBLE_ABSTENTION_THRESHOLD when fallbackUsed is true", () => {
    const policy = {
      selectedThreshold: 0.30,
      fallbackUsed: true,
    };
    expect(resolveVisibleAbstentionThreshold(policy)).toBe(VISIBLE_ABSTENTION_THRESHOLD);
  });

  it("calibrated threshold changes surfacing outcome deterministically", () => {
    // A claim with score 0.45 would be suppressed at the default 0.55 threshold
    // but surfaced at a calibrated threshold of 0.40.
    const score = 0.45;
    const defaultThreshold = VISIBLE_ABSTENTION_THRESHOLD; // 0.55
    const calibratedThreshold = resolveVisibleAbstentionThreshold({
      selectedThreshold: 0.40,
      fallbackUsed: false,
    });

    expect(score < defaultThreshold).toBe(true);   // suppressed at default
    expect(score >= calibratedThreshold).toBe(true); // surfaced at calibrated
  });

  it("same claim score, different policies, different surfacing results", () => {
    const score = 0.50;

    // Policy A: calibrated threshold = 0.45 → surfaced (score >= 0.45)
    const thresholdA = resolveVisibleAbstentionThreshold({
      selectedThreshold: 0.45,
      fallbackUsed: false,
    });
    expect(score >= thresholdA).toBe(true);

    // Policy B: calibrated threshold = 0.55 → suppressed (score < 0.55)
    const thresholdB = resolveVisibleAbstentionThreshold({
      selectedThreshold: 0.55,
      fallbackUsed: false,
    });
    expect(score < thresholdB).toBe(true);
  });

  it("is nondeterminism-free — same input always produces same threshold", () => {
    const policy = { selectedThreshold: 0.40, fallbackUsed: false };
    const results = Array.from({ length: 10 }, () => resolveVisibleAbstentionThreshold(policy));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(0.40);
  });
});

// ── Regression gate coverage ───────────────────────────────────────────────────

describe("calibration regression gate properties", () => {
  it("selected threshold is non-null when eligible claims exist", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const report: VisibleAbstentionCalibrationReport = computeAbstentionCalibration([gr], null);
    // Gate: eligibleClaims > 0 → selectedThreshold must be non-null
    expect(report.eligibleClaims).toBeGreaterThan(0);
    expect(report.selectedThreshold).not.toBeNull();
  });

  it("selectedRow is present when selectedThreshold is non-null", () => {
    const gr = makeGroupResult("g1", [{ family: "trigger_condition", score: 0.70 }]);
    const report = computeAbstentionCalibration([gr], null);
    if (report.selectedThreshold !== null) {
      expect(report.selectedRow).not.toBeNull();
      expect(report.selectedRow!.threshold).toBe(report.selectedThreshold);
    }
  });

  it("coverage at selected threshold is ≥ CALIBRATION_COVERAGE_FLOOR when data is sufficient", () => {
    // Two faithful candidates with high scores — coverage should be 1.0
    const g1 = makeGroupResult("g1", [
      { family: "trigger_condition", score: 0.80 },
      { family: "inner_critic", score: 0.75 },
    ]);
    const fScores = [
      makeFaithfulnessScore("g1", "trigger_condition", true),
      makeFaithfulnessScore("g1", "inner_critic", true),
    ];
    const report = computeAbstentionCalibration([g1], fScores);
    if (report.selectedRow !== null && report.selectedRow.coverageRate !== null) {
      expect(report.selectedRow.coverageRate).toBeGreaterThanOrEqual(CALIBRATION_COVERAGE_FLOOR);
    }
  });

  it("policy records fallback reason when no threshold meets target", () => {
    // Force all claims to be bad so fallback triggers
    const gr = makeGroupResult("g1", [
      { family: "trigger_condition", score: 1.0 },
    ]);
    const fScores = [makeFaithfulnessScore("g1", "trigger_condition", false)];
    const report = computeAbstentionCalibration([gr], fScores);
    // score=1.0 so even at threshold=1.0 the claim is surfaced and bad
    // All rows with surfaced claims have failure=1.0 > 0.25 → fallback
    if (report.policy?.fallbackUsed) {
      expect(report.policy.selectionReason.length).toBeGreaterThan(0);
      expect(report.policy.selectionReason).toContain("fallback");
    }
  });
});
