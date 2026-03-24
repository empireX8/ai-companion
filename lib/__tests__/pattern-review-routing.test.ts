/**
 * Review Routing Tests — Phase 9
 *
 * Covers:
 * 1. Low faithfulness triggers review
 * 2. Faithfulness parse failure triggers review
 * 3. LLM heuristic disagreement is inspectable
 * 4. LLM overreach triggers review
 * 5. Clean output does not trigger review
 * 6. Priority escalates when multiple reasons stack
 * 7. Review routing does not alter visible claim behavior
 * 8. buildEvalReport produces a reviewRouting report
 *
 * All tests use deterministic, injectable inputs.
 * No LLM calls, no DB, no network.
 */

import { describe, expect, it } from "vitest";

import {
  computeGroupReviewFlag,
  computeReviewRoutingReport,
  WEAK_SUPPORT_SCORE_MARGIN,
  evaluateGroup,
} from "../eval/pattern-evaluator";
import { VISIBLE_ABSTENTION_THRESHOLD } from "../pattern-visible-claim";
import type {
  EmittedFamilies,
  FaithfulnessClaimScore,
  GroupResult,
  LlmLfComparisonReport,
  VisibleClaimScoreRecord,
} from "../eval/eval-types";
import { buildEvalReport, loadGroupedDataset, loadMessageDataset } from "../../scripts/eval-patterns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmittedFamilies(overrides: Partial<EmittedFamilies> = {}): EmittedFamilies {
  return {
    trigger_condition: false,
    inner_critic: false,
    repetitive_loop: false,
    recovery_stabilizer: false,
    ...overrides,
  };
}

function makeGroupInput(opts: {
  groupId?: string;
  emittedFamilies?: Partial<EmittedFamilies>;
  visibleAbstentionScores?: VisibleClaimScoreRecord[];
}) {
  return {
    group: { id: opts.groupId ?? "test-group" },
    emittedFamilies: makeEmittedFamilies(opts.emittedFamilies ?? {}),
    visibleAbstentionScores: opts.visibleAbstentionScores ?? [],
  };
}

function makeFaithfulnessScore(
  groupId: string,
  opts: {
    faithful?: boolean | null;
    parseStatus?: FaithfulnessClaimScore["parseStatus"];
  } = {}
): FaithfulnessClaimScore {
  return {
    groupId,
    family: "trigger_condition",
    visibleSummary: "Pressure often pushes you toward avoidance.",
    receiptQuotes: ["I avoid difficult conversations"],
    faithful: opts.faithful ?? true,
    score: opts.faithful === false ? 0.1 : 0.9,
    rationale: opts.faithful === false ? "not grounded in quotes" : "well supported",
    parseStatus: opts.parseStatus ?? "parsed",
    shadowMode: true,
    usedForProductDecision: false,
  };
}

function makeMinimalLlmLfReport(overrides: Partial<LlmLfComparisonReport> = {}): LlmLfComparisonReport {
  return {
    totalCompared: 0,
    parsedCount: 0,
    parseFailures: 0,
    parseFailureRate: null,
    abstained: 0,
    abstentionRate: null,
    disagreementCount: 0,
    disagreementRate: null,
    malformedAcceptedCount: 0,
    authoritativeViolations: 0,
    helpedWhereHeuristicsAbstained: 0,
    overreachedWhereHeuristicsAbstained: 0,
    familyMetrics: [],
    disagreements: [],
    falsePositiveExamples: [],
    helpfulExamples: [],
    overreachExamples: [],
    parseFailureExamples: [],
    ...overrides,
  };
}

const ABOVE_THRESHOLD_SCORE = VISIBLE_ABSTENTION_THRESHOLD + 0.20; // clearly surfaced, not weak
const WEAK_SCORE = VISIBLE_ABSTENTION_THRESHOLD + 0.05;            // surfaced but weak
const BELOW_THRESHOLD_SCORE = VISIBLE_ABSTENTION_THRESHOLD - 0.10; // triggered (abstained)

function makeSurfacedScore(family: VisibleClaimScoreRecord["family"] = "trigger_condition", score = ABOVE_THRESHOLD_SCORE): VisibleClaimScoreRecord {
  return {
    family,
    score,
    triggered: false,
    evidenceCount: 5,
    sessionCount: 3,
    hasDisplaySafeQuote: true,
  };
}

function makeTriggeredScore(family: VisibleClaimScoreRecord["family"] = "trigger_condition"): VisibleClaimScoreRecord {
  return {
    family,
    score: BELOW_THRESHOLD_SCORE,
    triggered: true,
    evidenceCount: 1,
    sessionCount: 1,
    hasDisplaySafeQuote: false,
  };
}

// ── 1. Low faithfulness triggers review ───────────────────────────────────────

describe("1. low faithfulness triggers review", () => {
  it("produces review_needed=true with LOW_FAITHFULNESS when judge returns false", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-faith",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-faith", { faithful: false }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_needed).toBe(true);
    expect(flag.review_reasons).toContain("LOW_FAITHFULNESS");
    expect(flag.faithfulnessIncluded).toBe(true);
  });

  it("does not flag LOW_FAITHFULNESS when judge returns true", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-faith-pass",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-faith-pass", { faithful: true }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_reasons).not.toContain("LOW_FAITHFULNESS");
  });
});

// ── 2. Faithfulness parse failure triggers review ─────────────────────────────

describe("2. faithfulness parse failure triggers review", () => {
  it("produces FAITHFULNESS_PARSE_FAILURE when parseStatus is malformed_json", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-parse",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-parse", { faithful: null, parseStatus: "malformed_json" }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_needed).toBe(true);
    expect(flag.review_reasons).toContain("FAITHFULNESS_PARSE_FAILURE");
  });

  it("produces FAITHFULNESS_PARSE_FAILURE when parseStatus is request_failed", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-req-fail",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-req-fail", { faithful: null, parseStatus: "request_failed" }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_reasons).toContain("FAITHFULNESS_PARSE_FAILURE");
  });
});

// ── 3. LLM heuristic disagreement is inspectable ──────────────────────────────

describe("3. LLM heuristic disagreement is inspectable", () => {
  it("flags LLM_HEURISTIC_DISAGREEMENT when group emits TC and TC disagrees in comparison", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-disagree",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const llmLfComparison = makeMinimalLlmLfReport({
      disagreementCount: 1,
      disagreements: [
        {
          entryId: "e-1",
          text: "I always freeze when conflict starts",
          goldLabel: "trigger_condition",
          heuristicLabel: "trigger_condition",
          llmLabel: "abstain",
          parseStatus: "parsed",
          rationale: "too uncertain",
        },
      ],
    });

    const flag = computeGroupReviewFlag(groupInput, null, llmLfComparison);

    expect(flag.review_needed).toBe(true);
    expect(flag.review_reasons).toContain("LLM_HEURISTIC_DISAGREEMENT");
  });

  it("does not flag LLM_HEURISTIC_DISAGREEMENT for families not covered by LLM LF (RL, RS)", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-rl-no-disagree",
      emittedFamilies: { repetitive_loop: true },
      visibleAbstentionScores: [makeSurfacedScore("repetitive_loop")],
    });

    const llmLfComparison = makeMinimalLlmLfReport({
      disagreementCount: 1,
      disagreements: [
        {
          entryId: "e-2",
          text: "I hate myself for this pattern",
          goldLabel: "inner_critic",
          heuristicLabel: "inner_critic",
          llmLabel: "abstain",
          parseStatus: "parsed",
          rationale: "not confident",
        },
      ],
    });

    const flag = computeGroupReviewFlag(groupInput, null, llmLfComparison);

    expect(flag.review_reasons).not.toContain("LLM_HEURISTIC_DISAGREEMENT");
  });
});

// ── 4. LLM overreach triggers review ──────────────────────────────────────────

describe("4. LLM overreach triggers review", () => {
  it("flags LLM_OVERREACH when overreachExamples involve an emitted family", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-overreach",
      emittedFamilies: { inner_critic: true },
      visibleAbstentionScores: [makeSurfacedScore("inner_critic")],
    });

    const llmLfComparison = makeMinimalLlmLfReport({
      overreachedWhereHeuristicsAbstained: 1,
      overreachExamples: [
        {
          entryId: "e-3",
          text: "I feel uncertain about my choices lately",
          goldLabel: "none",
          heuristicLabel: "abstain",
          llmLabel: "inner_critic",
          parseStatus: "parsed",
          rationale: "possible inner critic pattern",
        },
      ],
    });

    const flag = computeGroupReviewFlag(groupInput, null, llmLfComparison);

    expect(flag.review_needed).toBe(true);
    expect(flag.review_reasons).toContain("LLM_OVERREACH");
  });
});

// ── 5. Clean output does not trigger review ───────────────────────────────────

describe("5. clean output does not trigger review", () => {
  it("review_needed=false when emitted family has strong score and no signals fire", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-clean",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore("trigger_condition", ABOVE_THRESHOLD_SCORE)],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-clean", { faithful: true }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_needed).toBe(false);
    expect(flag.review_priority).toBeNull();
    expect(flag.review_reasons).toHaveLength(0);
  });

  it("review_needed=false when group emitted nothing", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-abstain",
      emittedFamilies: {},
      visibleAbstentionScores: [],
    });

    const flag = computeGroupReviewFlag(groupInput);

    expect(flag.review_needed).toBe(false);
    expect(flag.emittedFamilies).toHaveLength(0);
  });
});

// ── 6. Priority escalates when multiple reasons stack ─────────────────────────

describe("6. priority escalates when multiple reasons stack", () => {
  it("HIGH when LOW_FAITHFULNESS + surfaced claims", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-high",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()], // not triggered → surfaced
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-high", { faithful: false }),
    ];

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores);

    expect(flag.review_priority).toBe("high");
  });

  it("HIGH when ≥3 reasons stack", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-multi",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeTriggeredScore(), makeSurfacedScore("inner_critic", WEAK_SCORE)],
    });

    // NO_SAFE_VISIBLE_SUMMARY + LOW_VISIBLE_COVERAGE + SURFACED_WITH_WEAK_SUPPORT → 3 reasons
    const emittedAndMissingScoreInput = makeGroupInput({
      groupId: "grp-three",
      emittedFamilies: { trigger_condition: true, inner_critic: true },
      visibleAbstentionScores: [
        makeTriggeredScore("trigger_condition"),    // LOW_VISIBLE_COVERAGE
        makeSurfacedScore("inner_critic", WEAK_SCORE), // SURFACED_WITH_WEAK_SUPPORT
        // recovery_stabilizer has no score → but not emitted, so no NO_SAFE_VISIBLE_SUMMARY
      ],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-three", { faithful: false }), // LOW_FAITHFULNESS
    ];

    const flag = computeGroupReviewFlag(emittedAndMissingScoreInput, faithfulnessScores);
    // Has: LOW_VISIBLE_COVERAGE + SURFACED_WITH_WEAK_SUPPORT + LOW_FAITHFULNESS = 3 reasons → HIGH
    expect(flag.review_priority).toBe("high");
  });

  it("MEDIUM when LLM_HEURISTIC_DISAGREEMENT without faithfulness failure", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-medium",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    const faithfulnessScores = [
      makeFaithfulnessScore("grp-medium", { faithful: true }), // pass
    ];

    const llmLfComparison = makeMinimalLlmLfReport({
      disagreements: [
        {
          entryId: "e-m",
          text: "I freeze when criticized",
          goldLabel: "trigger_condition",
          heuristicLabel: "trigger_condition",
          llmLabel: "abstain",
          parseStatus: "parsed",
          rationale: "borderline",
        },
      ],
    });

    const flag = computeGroupReviewFlag(groupInput, faithfulnessScores, llmLfComparison);

    expect(flag.review_priority).toBe("medium");
  });

  it("LOW when only NO_SAFE_VISIBLE_SUMMARY fires", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-low",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [], // no score → summary gate failed → NO_SAFE_VISIBLE_SUMMARY
    });

    const flag = computeGroupReviewFlag(groupInput, []);

    expect(flag.review_needed).toBe(true);
    expect(flag.review_priority).toBe("low");
    expect(flag.review_reasons).toContain("NO_SAFE_VISIBLE_SUMMARY");
  });
});

// ── 7. Review routing does not alter visible claim behavior ───────────────────

describe("7. review routing does not alter visible claim behavior", () => {
  it("reviewFlag has no effect on evaluateGroup output other than the reviewFlag field", () => {
    const group = {
      id: "grp-isolation",
      description: "isolation test",
      entries: [
        {
          text: "I tend to shut down whenever conflict starts escalating",
          session_id: "s1",
          role: "user" as const,
          source: "live_user" as const,
          seq: 1,
        },
      ],
      expected_behavioral: true,
      expected_families: {
        trigger_condition: true,
        inner_critic: false,
        repetitive_loop: false,
        recovery_stabilizer: false,
      },
      expected_abstain: false,
      expected_quote_safe: false,
    };

    const result = evaluateGroup(group);

    // reviewFlag is present and deterministic
    expect(result.reviewFlag).toBeDefined();
    expect(typeof result.reviewFlag.review_needed).toBe("boolean");
    expect(result.reviewFlag.faithfulnessIncluded).toBe(false); // no faithfulness at evaluateGroup time

    // Core product fields are unaffected by the review flag
    expect(typeof result.behavioral).toBe("boolean");
    expect(result.emittedFamilies).toBeDefined();
    expect(result.visibleAbstentionScores).toBeDefined();
  });

  it("computeReviewRoutingReport does not mutate groupResults", () => {
    const groupInput = makeGroupInput({
      groupId: "grp-immutable",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeSurfacedScore()],
    });

    // Cast to GroupResult for the report (reviewFlag is already set above in makeGroupInput context)
    const mockGroupResult = {
      ...groupInput,
      behavioral: true,
      anyClaimed: true,
      quoteSafe: false,
      behavioralCorrect: true,
      familiesCorrect: true,
      abstainCorrect: true,
      quoteSafeCorrect: true,
      falsePositiveFamilies: [] as GroupResult["falsePositiveFamilies"],
      falseNegativeFamilies: [] as GroupResult["falseNegativeFamilies"],
      clueQuotes: {
        trigger_condition: [],
        inner_critic: [],
        repetitive_loop: [],
        recovery_stabilizer: [],
      },
      group: {
        id: "grp-immutable",
        description: "test",
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
      reviewFlag: {
        groupId: "grp-immutable",
        emittedFamilies: ["trigger_condition" as const],
        review_needed: false,
        review_priority: null as null,
        review_reasons: [] as GroupResult["reviewFlag"]["review_reasons"],
        faithfulnessIncluded: false,
      },
    } satisfies GroupResult;

    const scoreBefore = mockGroupResult.visibleAbstentionScores[0]?.score;
    computeReviewRoutingReport([mockGroupResult]);
    const scoreAfter = mockGroupResult.visibleAbstentionScores[0]?.score;

    // visibleAbstentionScores unchanged after routing report
    expect(scoreAfter).toBe(scoreBefore);
  });
});

// ── 8. buildEvalReport produces a reviewRouting report ────────────────────────

describe("8. buildEvalReport produces reviewRouting in the report", () => {
  it("report.reviewRouting is non-null when grouped entries exist", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.reviewRouting).not.toBeNull();
    expect(typeof report.reviewRouting?.totalGroups).toBe("number");
    expect(typeof report.reviewRouting?.flaggedCount).toBe("number");
    expect(report.reviewRouting?.totalGroups).toBeGreaterThan(0);
    expect(report.reviewRouting?.priorityDistribution).toBeDefined();
    expect(report.reviewRouting?.reasonDistribution).toBeDefined();
    expect(Array.isArray(report.reviewRouting?.flaggedGroups)).toBe(true);
  });

  it("report.reviewRouting.faithfulnessIncluded is true when repo-local baseline is loaded by default", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    // repo-local faithfulness shadow baseline is loaded by default (Phase 9)
    expect(report.reviewRouting?.faithfulnessIncluded).toBe(true);
  });

  it("report.reviewRouting.totalGroups matches report.totalGroups", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.reviewRouting?.totalGroups).toBe(report.totalGroups);
  });

  it("WEAK_SUPPORT_SCORE_MARGIN is positive and visible abstention threshold is consistent", () => {
    expect(WEAK_SUPPORT_SCORE_MARGIN).toBeGreaterThan(0);
    expect(VISIBLE_ABSTENTION_THRESHOLD + WEAK_SUPPORT_SCORE_MARGIN).toBeLessThan(1);
  });
});

// ── computeReviewRoutingReport aggregation ────────────────────────────────────

describe("computeReviewRoutingReport aggregation", () => {
  it("flaggedRate is null when totalGroups is 0", () => {
    const report = computeReviewRoutingReport([]);

    expect(report.totalGroups).toBe(0);
    expect(report.flaggedRate).toBeNull();
    expect(report.flaggedGroups).toHaveLength(0);
  });

  it("counts reason distribution correctly across multiple groups", () => {
    const groupA = makeGroupInput({
      groupId: "agg-a",
      emittedFamilies: { trigger_condition: true },
      visibleAbstentionScores: [makeTriggeredScore()], // LOW_VISIBLE_COVERAGE
    });

    const groupB = makeGroupInput({
      groupId: "agg-b",
      emittedFamilies: { inner_critic: true },
      visibleAbstentionScores: [makeTriggeredScore("inner_critic")], // LOW_VISIBLE_COVERAGE
    });

    // Build mock GroupResults
    function toMockGroupResult(gi: ReturnType<typeof makeGroupInput>): GroupResult {
      return {
        ...gi,
        behavioral: true,
        anyClaimed: true,
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
        group: {
          id: gi.group.id,
          description: "test",
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
        reviewFlag: {
          groupId: gi.group.id,
          emittedFamilies: [],
          review_needed: false,
          review_priority: null,
          review_reasons: [],
          faithfulnessIncluded: false,
        },
      };
    }

    const report = computeReviewRoutingReport([
      toMockGroupResult(groupA),
      toMockGroupResult(groupB),
    ]);

    expect(report.flaggedCount).toBe(2);
    expect(report.reasonDistribution["LOW_VISIBLE_COVERAGE"]).toBe(2);
    expect(report.flaggedRate).toBeCloseTo(1.0);
  });
});
