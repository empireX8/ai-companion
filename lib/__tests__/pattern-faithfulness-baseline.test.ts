/**
 * Faithfulness Baseline Tests — Phase 9 Max-Out
 *
 * Covers:
 * 1. Default eval loads repo-local faithfulness baseline (no live model required)
 * 2. Grouped evaluation yields scoreable faithfulness units after receipt enrichment
 * 3. Faithful example is reported correctly
 * 4. Unfaithful example is reported correctly
 * 5. Parse failure is surfaced safely (not silently treated as valid)
 * 6. Faithfulness remains shadow-only (no product-authority leak)
 * 7. Regression gates include faithfulness by default
 * 8. buildEvalReport includes faithfulness section by default
 * 9. Grouped evidence bundle is richer than a single representative quote
 * 10. Default eval remains fully offline / deterministic
 */

import { describe, expect, it } from "vitest";

import {
  computeFaithfulnessReport,
  evaluateGroup,
  FAITHFULNESS_DATASET_FLOOR,
  FAITHFULNESS_FLOOR,
} from "../eval/pattern-evaluator";
import type { FaithfulnessClaimScore } from "../eval/eval-types";
import {
  buildEvalReport,
  loadFaithfulnessShadowDataset,
  loadGroupedDataset,
  loadMessageDataset,
  validateFaithfulnessShadowRecord,
} from "../../scripts/eval-patterns";

// ── 1. Default eval loads repo-local faithfulness baseline ────────────────────

describe("1. repo-local faithfulness baseline loads without live model", () => {
  it("loadFaithfulnessShadowDataset returns non-empty array from the committed dataset", () => {
    const scores = loadFaithfulnessShadowDataset();

    expect(scores.length).toBeGreaterThan(0);
    expect(scores.every((s) => s.shadowMode === true)).toBe(true);
    expect(scores.every((s) => s.usedForProductDecision === false)).toBe(true);
  });

  it("all records pass validateFaithfulnessShadowRecord", () => {
    const scores = loadFaithfulnessShadowDataset();

    for (const score of scores) {
      expect(validateFaithfulnessShadowRecord(score)).toBe(true);
    }
  });

  it("dataset includes at least one faithful, one unfaithful, and one non-parsed record", () => {
    const scores = loadFaithfulnessShadowDataset();

    const hasFaithful = scores.some((s) => s.faithful === true);
    const hasUnfaithful = scores.some((s) => s.faithful === false);
    const hasNonParsed = scores.some((s) => s.parseStatus !== "parsed");

    expect(hasFaithful).toBe(true);
    expect(hasUnfaithful).toBe(true);
    expect(hasNonParsed).toBe(true);
  });
});

// ── 2. Grouped eval yields scoreable units after receipt enrichment ────────────

describe("2. grouped evaluation produces scoreable visible claims after receipt enrichment", () => {
  it("evaluateGroup with TC-threshold group produces non-empty clueQuotes after enrichment", () => {
    // tc-group-threshold has 3 behavioral entries; after enrichment all become receipts
    const groups = loadGroupedDataset();
    const tcGroup = groups.find((g) => g.id === "tc-group-threshold");
    expect(tcGroup).toBeDefined();

    const result = evaluateGroup(tcGroup!);

    expect(result.emittedFamilies.trigger_condition).toBe(true);
    // After enrichment, clueQuotes should have all behavioral entries (≥3), not just 1
    expect(result.clueQuotes.trigger_condition.length).toBeGreaterThanOrEqual(3);
  });

  it("evaluateGroup produces non-empty visibleAbstentionScores after enrichment", () => {
    const groups = loadGroupedDataset();
    const allResults = groups.map(evaluateGroup);

    // At least some groups should now have scoreable visible claims
    const totalScored = allResults.reduce(
      (sum, r) => sum + r.visibleAbstentionScores.length,
      0
    );
    expect(totalScored).toBeGreaterThan(0);
  });

  it("tc-group-threshold produces a visibleAbstentionScore for trigger_condition after enrichment", () => {
    const groups = loadGroupedDataset();
    const tcGroup = groups.find((g) => g.id === "tc-group-threshold");
    const result = evaluateGroup(tcGroup!);

    const tcScore = result.visibleAbstentionScores.find(
      (s) => s.family === "trigger_condition"
    );
    expect(tcScore).toBeDefined();
    expect(tcScore?.score).toBeGreaterThan(0);
  });
});

// ── 3. Faithful example is reported correctly ──────────────────────────────────

describe("3. faithful example is reported correctly", () => {
  it("faithful score contributes to faithfulCount in report", () => {
    const faithfulScore: FaithfulnessClaimScore = {
      groupId: "tc-group-threshold",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you shut down or go quiet.",
      receiptQuotes: [
        "I tend to shut down whenever someone raises their voice at me",
        "Every time I'm given critical feedback, I freeze up and can't respond",
      ],
      faithful: true,
      score: 0.92,
      rationale: "Receipts clearly support the summary.",
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
    };

    const report = computeFaithfulnessReport([faithfulScore]);

    expect(report.faithfulCount).toBe(1);
    expect(report.unfaithfulCount).toBe(0);
    expect(report.faithfulRate).toBe(1.0);
    expect(report.authoritativeViolations).toBe(0);
  });

  it("repo-local dataset faithful records appear in faithfulCount", () => {
    const scores = loadFaithfulnessShadowDataset();
    const report = computeFaithfulnessReport(scores, FAITHFULNESS_DATASET_FLOOR);

    expect(report.faithfulCount).toBeGreaterThan(0);
  });
});

// ── 4. Unfaithful example is reported correctly ────────────────────────────────

describe("4. unfaithful example is reported correctly", () => {
  it("unfaithful score appears in unfaithfulClaims and unfaithfulCount", () => {
    const unfaithfulScore: FaithfulnessClaimScore = {
      groupId: "ic-group-threshold",
      family: "inner_critic",
      visibleSummary: "You often tell yourself you can't do it or get it right.",
      receiptQuotes: [
        "I'm terrible at keeping the commitments I make to myself",
        "I can't stop myself from catastrophizing whenever I make a mistake",
      ],
      faithful: false,
      score: 0.21,
      rationale: "Summary extrapolates beyond what receipts support.",
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
    };

    const report = computeFaithfulnessReport([unfaithfulScore]);

    expect(report.unfaithfulCount).toBe(1);
    expect(report.unfaithfulClaims).toHaveLength(1);
    expect(report.unfaithfulClaims[0]?.faithful).toBe(false);
    expect(report.faithfulRate).toBe(0);
  });

  it("repo-local dataset has unfaithful record that appears in report unfaithfulClaims", () => {
    const scores = loadFaithfulnessShadowDataset();
    const report = computeFaithfulnessReport(scores, FAITHFULNESS_DATASET_FLOOR);

    expect(report.unfaithfulCount).toBeGreaterThan(0);
    expect(report.unfaithfulClaims.some((c) => c.faithful === false)).toBe(true);
  });
});

// ── 5. Parse failure is surfaced safely ───────────────────────────────────────

describe("5. parse failure is surfaced safely", () => {
  it("malformed_json parseStatus results in faithful=null and appears in unfaithfulClaims", () => {
    const failedScore: FaithfulnessClaimScore = {
      groupId: "mixed-bundle",
      family: "trigger_condition",
      visibleSummary: "When pressure rises, you default to pleasing or appeasing.",
      receiptQuotes: ["Whenever I feel overwhelmed..."],
      faithful: null,
      score: null,
      rationale: "Malformed faithfulness output; shadow-mode abstain.",
      parseStatus: "malformed_json",
      shadowMode: true,
      usedForProductDecision: false,
    };

    const report = computeFaithfulnessReport([failedScore]);

    expect(report.parseFailureCount).toBe(1);
    expect(report.unfaithfulClaims).toHaveLength(1);
    expect(report.unfaithfulClaims[0]?.parseStatus).toBe("malformed_json");
    // parse failure is NOT counted as faithful or unfaithful
    expect(report.faithfulCount).toBe(0);
    expect(report.unfaithfulCount).toBe(0);
  });

  it("repo-local dataset has non-parsed records that appear in parseFailureCount", () => {
    const scores = loadFaithfulnessShadowDataset();
    const report = computeFaithfulnessReport(scores, FAITHFULNESS_DATASET_FLOOR);

    expect(report.parseFailureCount).toBeGreaterThan(0);
  });
});

// ── 6. Faithfulness remains shadow-only ───────────────────────────────────────

describe("6. faithfulness remains shadow-only, non-authoritative", () => {
  it("all repo-local records have shadowMode=true", () => {
    const scores = loadFaithfulnessShadowDataset();

    expect(scores.every((s) => s.shadowMode === true)).toBe(true);
  });

  it("all repo-local records have usedForProductDecision=false", () => {
    const scores = loadFaithfulnessShadowDataset();

    expect(scores.every((s) => s.usedForProductDecision === false)).toBe(true);
  });

  it("computeFaithfulnessReport computes authoritativeViolations=0 for all shadow-only records", () => {
    const scores = loadFaithfulnessShadowDataset();
    const report = computeFaithfulnessReport(scores, FAITHFULNESS_DATASET_FLOOR);

    expect(report.authoritativeViolations).toBe(0);
  });

  it("FAITHFULNESS_DATASET_FLOOR is lower than FAITHFULNESS_FLOOR", () => {
    // Dataset floor is calibrated to the intentionally mixed test dataset
    expect(FAITHFULNESS_DATASET_FLOOR).toBeLessThan(FAITHFULNESS_FLOOR);
    expect(FAITHFULNESS_DATASET_FLOOR).toBeGreaterThan(0);
  });
});

// ── 7. Regression gates include faithfulness by default ───────────────────────

describe("7. regression gates include faithfulness by default", () => {
  it("buildEvalReport includes faithfulness_floor gate by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const gate = report.regressionGates.find((g) => g.name === "faithfulness_floor");
    expect(gate).toBeDefined();
    expect(typeof gate?.passed).toBe("boolean");
  });

  it("faithfulness_floor gate uses FAITHFULNESS_DATASET_FLOOR threshold (not 0.80)", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const gate = report.regressionGates.find((g) => g.name === "faithfulness_floor");
    expect(gate?.threshold).toBe(FAITHFULNESS_DATASET_FLOOR);
    expect(gate?.threshold).not.toBe(FAITHFULNESS_FLOOR);
  });

  it("faithfulness_shadow_only gate is present and passes by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const gate = report.regressionGates.find((g) => g.name === "faithfulness_shadow_only");
    expect(gate).toBeDefined();
    expect(gate?.passed).toBe(true);
    expect(gate?.actual).toBe(0);
  });

  it("faithfulness_parse_failure_ceiling gate is present and passes by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const gate = report.regressionGates.find((g) => g.name === "faithfulness_parse_failure_ceiling");
    expect(gate).toBeDefined();
    expect(gate?.passed).toBe(true);
  });

  it("faithfulness_cases_visible gate is present and passes by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const gate = report.regressionGates.find((g) => g.name === "faithfulness_cases_visible");
    expect(gate).toBeDefined();
    expect(gate?.passed).toBe(true);
  });
});

// ── 8. buildEvalReport includes faithfulness section by default ───────────────

describe("8. buildEvalReport includes faithfulness section by default", () => {
  it("report.faithfulness is non-null when no explicit faithfulness is provided", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.faithfulness).not.toBeNull();
    expect(report.faithfulness?.scoredClaims).toBeGreaterThan(0);
  });

  it("report.faithfulness.authoritativeViolations is 0 by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.faithfulness?.authoritativeViolations).toBe(0);
  });

  it("explicit null faithfulnessReport disables faithfulness (backward-compat test)", () => {
    const report = buildEvalReport(
      loadMessageDataset(),
      loadGroupedDataset(),
      undefined,
      undefined,
      null  // explicitly disabled
    );

    expect(report.faithfulness).toBeNull();
    expect(report.rationaleSufficiency).toBeNull();
    expect(report.rationaleMinimality).toBeNull();
  });

  it("rationale sufficiency is derived only from faithfulness-scored pairs", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.faithfulness).not.toBeNull();
    expect(report.rationaleSufficiency).not.toBeNull();
    expect(report.rationaleMinimality).not.toBeNull();
    expect(report.rationaleSufficiency?.totalClaimsConsidered).toBe(report.faithfulness?.scoredClaims);
    expect(report.rationaleSufficiency?.scoredClaims).toBe(report.faithfulness?.faithfulCount);
    expect(report.rationaleSufficiency?.faithfulnessStabilityRate).not.toBeNull();
    expect(report.rationaleSufficiency?.faithfulnessStableCount).toBeGreaterThanOrEqual(0);
    expect(report.rationaleSufficiency?.faithfulnessDriftCount).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.totalEligibleClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.meanMinimalityRate).not.toBeNull();
    expect(report.rationaleMinimality?.globallyMinimalRate).not.toBeNull();
    expect(report.rationaleMinimality?.alternativeSupportRate).not.toBeNull();
    expect(report.rationaleMinimality?.searchedRationaleSubsetRate).not.toBeNull();
    expect(report.rationaleMinimality?.searchedComplementSubsetRate).not.toBeNull();
    expect(report.rationaleMinimality?.unknownMinimalityRate).not.toBeNull();
    expect(report.rationaleMinimality?.unknownAlternativeSupportRate).not.toBeNull();
    expect(report.rationaleMinimality?.meanChosenVsMinimalSubsetDelta).not.toBeNull();
    expect(report.rationaleMinimality?.competitiveAlternativeSupportRate).not.toBeNull();
  });
});

// ── 9. Grouped evidence bundle is richer than a single representative quote ────

describe("9. grouped evidence bundle is richer than a single representative quote", () => {
  it("evaluateGroup enriches clueQuotes beyond a single detector-extracted quote", () => {
    // tc-group-threshold: TC fires with TC_MIN_MATCHES=3.
    // Detector returns 1 clue with 1 quote. After enrichment, all 3 behavioral texts included.
    const groups = loadGroupedDataset();
    const tcGroup = groups.find((g) => g.id === "tc-group-threshold");
    const result = evaluateGroup(tcGroup!);

    // More than 1 quote → enriched beyond single representative
    expect(result.clueQuotes.trigger_condition.length).toBeGreaterThan(1);
    // All 3 behavioral entries are included
    expect(result.clueQuotes.trigger_condition.length).toBeGreaterThanOrEqual(3);
  });

  it("mixed-bundle TC clueQuotes contains multiple behavioral entry texts", () => {
    const groups = loadGroupedDataset();
    const mixedGroup = groups.find((g) => g.id === "mixed-bundle");
    const result = evaluateGroup(mixedGroup!);

    if (result.emittedFamilies.trigger_condition) {
      // mixed-bundle has 8 behavioral entries; TC should have all of them
      expect(result.clueQuotes.trigger_condition.length).toBeGreaterThan(2);
    }
  });

  it("non-emitted families have empty clueQuotes even after enrichment", () => {
    const groups = loadGroupedDataset();
    const tcGroup = groups.find((g) => g.id === "tc-group-threshold");
    const result = evaluateGroup(tcGroup!);

    // TC group: only TC fires; IC, RL, RS should remain empty
    expect(result.clueQuotes.inner_critic).toHaveLength(0);
    expect(result.clueQuotes.repetitive_loop).toHaveLength(0);
    expect(result.clueQuotes.recovery_stabilizer).toHaveLength(0);
  });
});

// ── 10. Default eval remains fully offline / deterministic ────────────────────

describe("10. default eval is fully offline and deterministic", () => {
  it("buildEvalReport with default args produces same faithfulness section across two calls", () => {
    const report1 = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const report2 = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report1.faithfulness?.faithfulCount).toBe(report2.faithfulness?.faithfulCount);
    expect(report1.faithfulness?.faithfulRate).toBe(report2.faithfulness?.faithfulRate);
    expect(report1.faithfulness?.authoritativeViolations).toBe(
      report2.faithfulness?.authoritativeViolations
    );
  });

  it("loadFaithfulnessShadowDataset is idempotent (same result each call)", () => {
    const scores1 = loadFaithfulnessShadowDataset();
    const scores2 = loadFaithfulnessShadowDataset();

    expect(scores1.length).toBe(scores2.length);
    expect(scores1.map((s) => s.groupId)).toEqual(scores2.map((s) => s.groupId));
  });

  it("faithfulness gate threshold is calibrated to dataset floor (not live LLM floor)", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const gate = report.regressionGates.find((g) => g.name === "faithfulness_floor");

    // Should use FAITHFULNESS_DATASET_FLOOR, not FAITHFULNESS_FLOOR
    expect(gate?.threshold).toBe(FAITHFULNESS_DATASET_FLOOR);
  });
});
