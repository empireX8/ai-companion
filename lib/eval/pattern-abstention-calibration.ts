/**
 * Visible Claim Abstention Calibration (Phase 10)
 *
 * Replaces fixed abstention thresholding with an empirically calibrated policy.
 *
 * Decision unit:
 *   One emitted visible-claim candidate per family per adjudication group —
 *   already past the summary gate (visibleAbstentionScores entries).
 *
 * Failure definition:
 *   A surfaced claim is "bad" when:
 *     - faithfulness verdict is false, OR
 *     - faithfulness parseStatus is not "parsed"
 *   When faithfulness data is absent, isBadClaim defaults to false.
 *
 * Selection rule (priority order):
 *   1. Keep only thresholds with failureRate <= TARGET_FAILURE_RATE.
 *   2. Among those, choose highest coverageRate.
 *   3. Tie-breaker: lowest threshold.
 *   4. If no threshold satisfies the target:
 *      - choose lowest failureRate, then highest coverageRate, then lowest threshold.
 *
 * Boundaries:
 *   - contradiction_drift is not an ActiveFamily — it cannot appear in
 *     visibleAbstentionScores and requires no explicit exclusion.
 *   - Calibration is offline and deterministic. Same inputs → same output.
 *   - Does NOT replace the existing score formula or summary gate.
 *   - Runtime consumption is through resolveVisibleAbstentionThreshold in
 *     pattern-visible-claim.ts — never by direct disk read.
 */

import type {
  ActiveFamily,
  FaithfulnessClaimScore,
  GroupResult,
  VisibleAbstentionCalibrationReport,
  VisibleAbstentionPolicy,
  VisibleCalibrationRow,
} from "./eval-types";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Target maximum failure rate for threshold selection.
 * A threshold is only eligible if its surfaced-claim failure rate is at or
 * below this value. Named constant — not a magic number.
 */
export const CALIBRATION_TARGET_FAILURE_RATE = 0.25;

/**
 * Coverage floor for the calibration regression gate.
 * When data is sufficient, the selected threshold must surface at least
 * this fraction of eligible claims.
 *
 * Set to 0.40 to match the empirical Phase 12 dataset composition: the
 * faithfulness shadow set is intentionally mixed (more bad than good),
 * so the calibration selects a higher threshold that sacrifices some
 * coverage to satisfy the failure rate target.
 */
export const CALIBRATION_COVERAGE_FLOOR = 0.40;

/**
 * Minimum number of calibration-eligible claims required for the calibration
 * dataset to be considered non-trivially small.
 *
 * A claim is eligible when its family emitted a visible summary (cleared the
 * summary gate) and produced a visibleAbstentionScores entry. This floor
 * guards against calibration running on a dataset too small to be meaningful.
 *
 * Calibrated to the Phase 12 expanded dataset target: 8 eligible claims.
 */
export const CALIBRATION_DATA_SUFFICIENCY_FLOOR = 8;

/**
 * Deterministic threshold grid: 0.00, 0.05, 0.10, ..., 1.00 (21 values).
 * Fixed grid — no adaptive search.
 */
export const CALIBRATION_THRESHOLD_GRID: readonly number[] = Array.from(
  { length: 21 },
  (_, i) => parseFloat((i * 0.05).toFixed(2))
);

// ── Internal types ─────────────────────────────────────────────────────────────

/** Internal candidate record — not exported. */
type CalibrationCandidate = {
  groupId: string;
  family: ActiveFamily;
  /** Composite abstention score in [0, 1] from scoreVisiblePatternClaim. */
  score: number;
  /**
   * True when faithfulness verdict is false OR parseStatus !== "parsed".
   * False when faithful === true or no faithfulness data is available.
   */
  isBadClaim: boolean;
};

// ── Candidate extraction ───────────────────────────────────────────────────────

/**
 * Build the flat list of calibration candidates from grouped results.
 *
 * Each entry in groupResult.visibleAbstentionScores is one candidate:
 *   - It already cleared the summary gate (Layer 1).
 *   - Its score is used to decide surfacing at each candidate threshold.
 *   - isBadClaim is resolved from faithfulness data when available.
 *
 * contradiction_drift is not an ActiveFamily and cannot appear here.
 */
export function extractCalibrationCandidates(
  groupResults: GroupResult[],
  faithfulnessAllScores: FaithfulnessClaimScore[] | null
): CalibrationCandidate[] {
  // Build O(1) faithfulness lookup keyed by "groupId:family".
  const faithMap = new Map<string, FaithfulnessClaimScore>();
  if (faithfulnessAllScores) {
    for (const s of faithfulnessAllScores) {
      faithMap.set(`${s.groupId}:${s.family}`, s);
    }
  }

  const candidates: CalibrationCandidate[] = [];

  for (const gr of groupResults) {
    for (const scoreRecord of gr.visibleAbstentionScores) {
      const key = `${gr.group.id}:${scoreRecord.family}`;
      const faithScore = faithMap.get(key);

      let isBadClaim = false;
      if (faithScore !== undefined) {
        isBadClaim =
          faithScore.faithful === false || faithScore.parseStatus !== "parsed";
      }

      candidates.push({
        groupId: gr.group.id,
        family: scoreRecord.family,
        score: scoreRecord.score,
        isBadClaim,
      });
    }
  }

  return candidates;
}

// ── Per-threshold row computation ─────────────────────────────────────────────

/**
 * Compute calibration metrics for a single threshold value.
 * Surfaced = score >= threshold (not strictly greater — at-threshold is surfaced).
 */
export function computeCalibrationRow(
  candidates: CalibrationCandidate[],
  threshold: number
): VisibleCalibrationRow {
  const eligibleClaims = candidates.length;
  const surfaced = candidates.filter((c) => c.score >= threshold);
  const surfacedClaims = surfaced.length;
  const abstainedClaims = eligibleClaims - surfacedClaims;
  const failureCount = surfaced.filter((c) => c.isBadClaim).length;
  const faithfulSurfacedCount = surfaced.filter((c) => !c.isBadClaim).length;

  const coverageRate =
    eligibleClaims === 0 ? null : surfacedClaims / eligibleClaims;
  const failureRate =
    surfacedClaims === 0 ? null : failureCount / surfacedClaims;
  const faithfulSurfacedRate =
    surfacedClaims === 0 ? null : faithfulSurfacedCount / surfacedClaims;

  return {
    threshold,
    eligibleClaims,
    surfacedClaims,
    abstainedClaims,
    coverageRate,
    failureCount,
    failureRate,
    faithfulSurfacedCount,
    faithfulSurfacedRate,
  };
}

// ── Threshold selection ────────────────────────────────────────────────────────

type SelectionResult = {
  selectedRow: VisibleCalibrationRow | null;
  selectedThreshold: number | null;
  selectionReason: string;
  fallbackUsed: boolean;
};

/**
 * Apply the deterministic selection rule to pick the best threshold.
 *
 * Priority order:
 *   1. Keep only rows where failureRate <= targetFailureRate (or failureRate is null).
 *   2. Among those: highest coverageRate.
 *   3. Tie on coverageRate: lowest threshold.
 *   4. If no row satisfies the target:
 *      - lowest failureRate, then highest coverageRate, then lowest threshold.
 *      - fallbackUsed = true.
 */
export function selectCalibratedThreshold(
  rows: VisibleCalibrationRow[],
  targetFailureRate: number
): SelectionResult {
  if (rows.length === 0) {
    return {
      selectedRow: null,
      selectedThreshold: null,
      selectionReason: "no_rows_in_grid",
      fallbackUsed: false,
    };
  }

  // If there are no eligible claims at all, coverageRate is always null.
  // In that case just return the first row with no selection made.
  const hasEligible = rows.some((r) => r.eligibleClaims > 0);
  if (!hasEligible) {
    return {
      selectedRow: null,
      selectedThreshold: null,
      selectionReason: "no_eligible_claims",
      fallbackUsed: false,
    };
  }

  // ── Primary path: thresholds that satisfy the failure rate target ──────────
  const satisfying = rows.filter(
    (r) => r.failureRate === null || r.failureRate <= targetFailureRate
  );

  if (satisfying.length > 0) {
    const best = satisfying.reduce<VisibleCalibrationRow>((acc, row) => {
      const accCov = acc.coverageRate ?? 0;
      const rowCov = row.coverageRate ?? 0;
      if (rowCov > accCov) return row;
      if (rowCov === accCov && row.threshold < acc.threshold) return row;
      return acc;
    }, satisfying[0]!);

    return {
      selectedRow: best,
      selectedThreshold: best.threshold,
      selectionReason: `target_failure_rate_${targetFailureRate}_coverage_maximized`,
      fallbackUsed: false,
    };
  }

  // ── Fallback path: no threshold satisfies the target ──────────────────────
  const leastBad = rows.reduce<VisibleCalibrationRow>((acc, row) => {
    const accFR = acc.failureRate ?? 1;
    const rowFR = row.failureRate ?? 1;
    if (rowFR < accFR) return row;
    if (rowFR === accFR) {
      const accCov = acc.coverageRate ?? 0;
      const rowCov = row.coverageRate ?? 0;
      if (rowCov > accCov) return row;
      if (rowCov === accCov && row.threshold < acc.threshold) return row;
    }
    return acc;
  }, rows[0]!);

  return {
    selectedRow: leastBad,
    selectedThreshold: leastBad.threshold,
    selectionReason: `fallback_least_bad_no_threshold_meets_target_${targetFailureRate}`,
    fallbackUsed: true,
  };
}

// ── Top-level calibration entry point ─────────────────────────────────────────

/**
 * Run the full visible claim abstention calibration pipeline.
 *
 * Steps:
 *  1. Extract calibration candidates from grouped evaluator results.
 *  2. Compute per-threshold metrics across CALIBRATION_THRESHOLD_GRID.
 *  3. Select the best threshold deterministically.
 *  4. Produce a VisibleAbstentionCalibrationReport for the eval report.
 *
 * Deterministic: same groupResults + faithfulnessAllScores → same output.
 * Offline only: never called in the online request path.
 */
export function computeAbstentionCalibration(
  groupResults: GroupResult[],
  faithfulnessAllScores: FaithfulnessClaimScore[] | null
): VisibleAbstentionCalibrationReport {
  const candidates = extractCalibrationCandidates(groupResults, faithfulnessAllScores);
  const rows = CALIBRATION_THRESHOLD_GRID.map((t) =>
    computeCalibrationRow(candidates, t)
  );

  const {
    selectedRow,
    selectedThreshold,
    selectionReason,
    fallbackUsed,
  } = selectCalibratedThreshold(rows, CALIBRATION_TARGET_FAILURE_RATE);

  const policy: VisibleAbstentionPolicy | null =
    selectedThreshold !== null
      ? {
          selectedThreshold,
          targetFailureRate: CALIBRATION_TARGET_FAILURE_RATE,
          selectionReason,
          fallbackUsed,
        }
      : null;

  return {
    rows,
    eligibleClaims: candidates.length,
    selectedThreshold,
    targetFailureRate: CALIBRATION_TARGET_FAILURE_RATE,
    selectedRow,
    policy,
  };
}
