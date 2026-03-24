import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  AdjudicationEntry,
  AdjudicationGroup,
  EvalReport,
} from "../eval/eval-types";
import {
  FAITHFULNESS_FLOOR,
  REGRESSION_THRESHOLDS,
  classifyQuoteFpCategory,
  compareLlmLfOutputs,
  computeFaithfulnessReport,
  computeGroupMetrics,
  computeMetrics,
  evaluateExample,
  evaluateGroup,
  runRegressionGates,
  validateAdjudicationEntry,
  validateAdjudicationGroup,
} from "../eval/pattern-evaluator";
import {
  buildEvalReport,
  buildVisibleAbstentionPolicyArtifact,
  loadGroupedDataset,
  loadFaithfulnessShadowDataset,
  loadLlmLfShadowDataset,
  loadMessageDataset,
  shouldRunFaithfulnessScoring,
  validateFaithfulnessShadowRecord,
  validateLlmLfShadowRecord,
  writeLatestReport,
  writeVisibleAbstentionPolicyArtifact,
} from "../../scripts/eval-patterns";
import { CALIBRATION_DATA_SUFFICIENCY_FLOOR } from "../eval/pattern-abstention-calibration";
import { buildReviewQueueArtifact, writeReviewQueueJson } from "../eval/pattern-review-queue";
import { VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION } from "../visible-abstention-policy";

function makeEntry(overrides: Partial<AdjudicationEntry> = {}): AdjudicationEntry {
  return {
    id: "test-001",
    text: "I always start appeasing people when they seem upset with me",
    source: "live_user",
    behavioral_label: "behavioral",
    family_label: "trigger_condition",
    quote_label: "suitable",
    should_abstain: false,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<AdjudicationGroup> = {}): AdjudicationGroup {
  return {
    id: "group-001",
    description: "Default TC threshold group",
    entries: [
      {
        text: "I tend to shut down whenever conflict starts escalating",
        session_id: "g1-s1",
        role: "user",
        source: "live_user",
        seq: 1,
      },
      {
        text: "Every time I'm criticized, I freeze and can't respond clearly",
        session_id: "g1-s1",
        role: "user",
        source: "live_user",
        seq: 2,
      },
      {
        text: "I notice that I always go quiet when people seem upset with me",
        session_id: "g1-s2",
        role: "user",
        source: "live_user",
        seq: 3,
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
    expected_quote_safe: true,
    ...overrides,
  };
}

describe("message-level adjudication schema", () => {
  it("accepts a valid message-level entry", () => {
    expect(validateAdjudicationEntry(makeEntry())).toBe(true);
  });

  it("loads and validates the repo-local message dataset", () => {
    const entries = loadMessageDataset();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => validateAdjudicationEntry(entry))).toBe(true);
  });
});

describe("grouped adjudication schema", () => {
  it("accepts a valid grouped entry", () => {
    expect(validateAdjudicationGroup(makeGroup())).toBe(true);
  });

  it("loads and validates the repo-local grouped dataset", () => {
    const groups = loadGroupedDataset();
    expect(groups.length).toBeGreaterThanOrEqual(10);
    expect(groups.every((group) => validateAdjudicationGroup(group))).toBe(true);
  });

  it("loads reviewed grouped overlay and lets overlay win by id", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-group-overlay-"));
    const basePath = path.join(tempDir, "adjudication-groups.jsonl");
    const overlayPath = path.join(tempDir, "adjudication-groups.reviewed.jsonl");

    fs.writeFileSync(
      basePath,
      JSON.stringify(makeGroup()) + "\n",
      "utf-8"
    );
    fs.writeFileSync(
      overlayPath,
      JSON.stringify({
        ...makeGroup({ description: "reviewed grouped description" }),
        reviewMetadata: {
          sourceQueueRun: "2026-03-18T15:00:00.000Z",
          reviewedAt: "2026-03-18T16:00:00.000Z",
          reviewer: "tester",
          resolutionReason: "corrected grouped label",
          resolutionStatus: "modified",
        },
      }) + "\n",
      "utf-8"
    );

    const groups = loadGroupedDataset(basePath, overlayPath);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.description).toBe("reviewed grouped description");
  });
});

describe("LLM LF shadow dataset schema", () => {
  it("loads and validates the repo-local LLM LF shadow dataset", () => {
    const rows = loadLlmLfShadowDataset();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => validateLlmLfShadowRecord(row))).toBe(true);
  });
});

describe("faithfulness shadow dataset schema", () => {
  it("loads reviewed faithfulness overlay and lets overlay win by groupId:family", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-faith-overlay-"));
    const basePath = path.join(tempDir, "faithfulness-shadow-set.jsonl");
    const overlayPath = path.join(tempDir, "faithfulness-shadow-reviewed.jsonl");

    fs.writeFileSync(
      basePath,
      JSON.stringify({
        groupId: "group-001",
        family: "trigger_condition",
        visibleSummary: "old summary",
        receiptQuotes: ["old quote"],
        faithful: false,
        score: 0.1,
        rationale: "old",
        parseStatus: "parsed",
        shadowMode: true,
        usedForProductDecision: false,
      }) + "\n",
      "utf-8"
    );
    fs.writeFileSync(
      overlayPath,
      JSON.stringify({
        groupId: "group-001",
        family: "trigger_condition",
        visibleSummary: "new summary",
        receiptQuotes: ["new quote"],
        faithful: true,
        score: 0.9,
        rationale: "reviewed",
        parseStatus: "parsed",
        shadowMode: true,
        usedForProductDecision: false,
        reviewMetadata: {
          sourceQueueRun: "2026-03-18T15:00:00.000Z",
          reviewedAt: "2026-03-18T16:00:00.000Z",
          reviewer: "tester",
          resolutionReason: "corrected faithfulness label",
          resolutionStatus: "modified",
        },
      }) + "\n",
      "utf-8"
    );

    const rows = loadFaithfulnessShadowDataset(basePath, overlayPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visibleSummary).toBe("new summary");
  });
});

describe("message-level evaluation", () => {
  it("uses the real behavioral gate for should-abstain examples", () => {
    const result = evaluateExample(
      makeEntry({
        id: "abstain-1",
        text: "What are the symptoms of burnout?",
        behavioral_label: "non_behavioral",
        family_label: "none",
        quote_label: "unsuitable",
        should_abstain: true,
      })
    );

    expect(result.prediction.behavioral).toBe(false);
    expect(result.abstainedCorrectly).toBe(true);
  });

  it("surfaces quote false-positive categories", () => {
    expect(
      classifyQuoteFpCategory("I hate myself for doing this again", undefined)
    ).toBe("raw_self_attack");
    expect(
      classifyQuoteFpCategory("Can you explain why I do this?", undefined)
    ).toBe("topic_or_question");
  });
});

describe("grouped evaluator", () => {
  it("runs real grouped detector logic for TC threshold behavior", () => {
    const result = evaluateGroup(makeGroup());
    expect(result.behavioral).toBe(true);
    expect(result.emittedFamilies.trigger_condition).toBe(true);
    expect(result.anyClaimed).toBe(true);
  });

  it("measures IC grouped threshold behavior", () => {
    const result = evaluateGroup(
      makeGroup({
        id: "group-ic",
        description: "IC threshold",
        entries: [
          {
            text: "I'm terrible at staying consistent with anything important",
            session_id: "ic-s1",
            role: "user",
            source: "live_user",
            seq: 1,
          },
          {
            text: "I can't stop second-guessing every decision I make",
            session_id: "ic-s1",
            role: "user",
            source: "live_user",
            seq: 2,
          },
          {
            text: "I always ruin things when they start going well",
            session_id: "ic-s2",
            role: "user",
            source: "live_user",
            seq: 3,
          },
        ],
        expected_families: {
          trigger_condition: false,
          inner_critic: true,
          repetitive_loop: false,
          recovery_stabilizer: false,
        },
      })
    );

    expect(result.emittedFamilies.inner_critic).toBe(true);
    expect(result.familiesCorrect).toBe(true);
  });

  it("measures RS grouped threshold behavior", () => {
    const result = evaluateGroup(
      makeGroup({
        id: "group-rs",
        description: "RS threshold",
        entries: [
          {
            text: "I've been doing better at calming myself down this week",
            session_id: "rs-s1",
            role: "user",
            source: "live_user",
            seq: 1,
          },
          {
            text: "I finally managed to step away before the argument escalated",
            session_id: "rs-s1",
            role: "user",
            source: "live_user",
            seq: 2,
          },
        ],
        expected_families: {
          trigger_condition: false,
          inner_critic: false,
          repetitive_loop: false,
          recovery_stabilizer: true,
        },
      })
    );

    expect(result.emittedFamilies.recovery_stabilizer).toBe(true);
    expect(result.familiesCorrect).toBe(true);
  });

  it("measures RL grouped multi-session behavior", () => {
    const result = evaluateGroup(
      makeGroup({
        id: "group-rl",
        description: "RL multi-session threshold",
        entries: [
          {
            text: "I keep ending up in the same loop with this",
            session_id: "rl-s1",
            role: "user",
            source: "live_user",
            seq: 1,
          },
          {
            text: "Over and over I go through the same cycle",
            session_id: "rl-s2",
            role: "user",
            source: "live_user",
            seq: 2,
          },
          {
            text: "I'm still stuck in this same pattern",
            session_id: "rl-s2",
            role: "user",
            source: "live_user",
            seq: 3,
          },
        ],
        expected_families: {
          trigger_condition: false,
          inner_critic: false,
          repetitive_loop: true,
          recovery_stabilizer: false,
        },
      })
    );

    expect(result.emittedFamilies.repetitive_loop).toBe(true);
    expect(result.familiesCorrect).toBe(true);
  });

  it("keeps one-session RL false positives blocked", () => {
    const result = evaluateGroup(
      makeGroup({
        id: "group-rl-single",
        description: "RL single session blocked",
        entries: [
          {
            text: "I keep ending up in the same loop with this",
            session_id: "rl-solo",
            role: "user",
            source: "live_user",
            seq: 1,
          },
          {
            text: "Over and over I go through the same cycle",
            session_id: "rl-solo",
            role: "user",
            source: "live_user",
            seq: 2,
          },
          {
            text: "I'm still stuck in this same pattern",
            session_id: "rl-solo",
            role: "user",
            source: "live_user",
            seq: 3,
          },
        ],
        expected_families: {
          trigger_condition: false,
          inner_critic: false,
          repetitive_loop: false,
          recovery_stabilizer: false,
        },
        expected_abstain: true,
        expected_quote_safe: false,
      })
    );

    expect(result.emittedFamilies.repetitive_loop).toBe(false);
    expect(result.abstainCorrect).toBe(true);
  });

  it("counts claim-level abstention correctly", () => {
    const groupedMetrics = computeGroupMetrics([
      evaluateGroup(
        makeGroup({
          id: "group-abstain",
          description: "All topic questions",
          entries: [
            {
              text: "What triggers avoidance behavior in relationships?",
              session_id: "ga-1",
              role: "user",
              source: "live_user",
              seq: 1,
            },
            {
              text: "How does a trigger response develop over time?",
              session_id: "ga-1",
              role: "user",
              source: "live_user",
              seq: 2,
            },
          ],
          expected_behavioral: false,
          expected_families: {
            trigger_condition: false,
            inner_critic: false,
            repetitive_loop: false,
            recovery_stabilizer: false,
          },
          expected_abstain: true,
          expected_quote_safe: false,
        })
      ),
    ]);

    expect(groupedMetrics.abstentionTotal).toBe(1);
    expect(groupedMetrics.abstentionCorrect).toBe(1);
    expect(groupedMetrics.abstentionRate).toBe(1);
  });
});

describe("reporting and regression gates", () => {
  it("keeps message-level and grouped-level sections distinct in the report object", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    expect(report.behavioral.truePositives).toBeTypeOf("number");
    expect(report.groupedMetrics.groupsEvaluated).toBeTypeOf("number");
    expect(report.totalExamples).toBeGreaterThan(0);
    expect(report.totalGroups).toBeGreaterThan(0);
  });

  it("writes a machine-readable report with expected keys", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-eval-"));
    const reportPath = path.join(tempDir, "latest.json");
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset(), reportPath);

    writeLatestReport(report, reportPath);

    const parsed = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as EvalReport;
    expect(parsed.generatedAt).toBeTypeOf("string");
    expect(parsed.datasets.reportPath).toBe(reportPath);
    expect(parsed.groupedMetrics.groupsEvaluated).toBeGreaterThan(0);
    expect(parsed.quoteFpByCategory).toHaveProperty("raw_self_attack");
    expect(parsed.llmLfComparison).not.toBeNull();
    expect(parsed.datasets.llmLfShadowPath).toContain("llm-lf-shadow-set.jsonl");
    expect(parsed.regressionGates.length).toBeGreaterThan(0);
  });

  it("derives a runtime visible-abstention policy artifact from the eval report", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const artifact = buildVisibleAbstentionPolicyArtifact(report);

    expect(artifact.version).toBe(VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION);
    expect(artifact.generatedAt).toBe(report.generatedAt);
    expect(artifact.sourceReportPath).toBe(report.datasets.reportPath);
    expect(artifact.selectedThreshold).toBe(report.visibleCalibration?.selectedThreshold ?? null);
    expect(artifact.targetFailureRate).toBe(report.visibleCalibration?.targetFailureRate ?? 0.25);
    expect(artifact.eligibleClaims).toBe(report.visibleCalibration?.eligibleClaims ?? 0);
    expect(artifact.fallbackUsed).toBe(report.visibleCalibration?.policy?.fallbackUsed ?? true);
    expect(artifact.selectionReason).toBe(report.visibleCalibration?.policy?.selectionReason ?? "no_visible_calibration_policy");
    expect(artifact.calibrationGateStatus.thresholdSelected).toBe(
      report.regressionGates.find((gate) => gate.name === "visible_calibration_threshold_selected")?.passed ?? false
    );
    expect(artifact.calibrationGateStatus.coverageFloorPassed).toBe(
      report.regressionGates.find((gate) => gate.name === "visible_calibration_coverage_floor")?.passed ?? false
    );
    expect(artifact.calibrationGateStatus.failureTargetRespected).toBe(
      report.regressionGates.find((gate) => gate.name === "visible_calibration_failure_target_respected")?.passed ?? false
    );
    expect(artifact.calibrationGateStatus.dataSufficient).toBe(
      report.regressionGates.find((gate) => gate.name === "visible_calibration_data_sufficient")?.passed ?? false
    );
  });

  it("writes the visible-abstention policy artifact deterministically for the same report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-policy-"));
    const policyPathA = path.join(tempDir, "visible-abstention-policy-a.json");
    const policyPathB = path.join(tempDir, "visible-abstention-policy-b.json");
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    const artifactA = buildVisibleAbstentionPolicyArtifact(report);
    const artifactB = buildVisibleAbstentionPolicyArtifact(report);

    expect(artifactA).toEqual(artifactB);

    writeVisibleAbstentionPolicyArtifact(artifactA, policyPathA);
    writeVisibleAbstentionPolicyArtifact(artifactB, policyPathB);

    expect(fs.readFileSync(policyPathA, "utf-8")).toBe(fs.readFileSync(policyPathB, "utf-8"));
  });

  it("writes a deterministic review queue artifact for flagged grouped claims", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-review-"));
    const queuePathA = path.join(tempDir, "review-queue-a.json");
    const queuePathB = path.join(tempDir, "review-queue-b.json");
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    writeReviewQueueJson(buildReviewQueueArtifact(report), queuePathA);
    writeReviewQueueJson(buildReviewQueueArtifact(report), queuePathB);

    const parsed = JSON.parse(fs.readFileSync(queuePathA, "utf-8")) as { items: Array<{ groupId: string; priority: string }> };
    expect(parsed.items.length).toBe(report.reviewRouting?.flaggedCount ?? 0);
    expect(parsed.items.every((item) => typeof item.groupId === "string" && typeof item.priority === "string")).toBe(true);
    expect(fs.readFileSync(queuePathA, "utf-8")).toBe(fs.readFileSync(queuePathB, "utf-8"));
  });

  it("includes LLM LF comparison reporting by default when the repo-local shadow dataset exists", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    expect(report.llmLfComparison?.totalCompared).toBeGreaterThan(0);
    expect(report.llmLfComparison?.familyMetrics).toHaveLength(2);
  });

  it("uses the repo-local LLM LF baseline without requiring live model calls", () => {
    const rows = loadLlmLfShadowDataset();
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset(), undefined, rows);
    expect(report.llmLfComparison?.totalCompared).toBe(rows.length);
  });

  it("reports quote failure category counts in message-level metrics", () => {
    const report = computeMetrics([
      evaluateExample(
        makeEntry({
          id: "quote-fp-1",
          text: "I hate myself for doing this again",
          family_label: "inner_critic",
          quote_label: "unsuitable",
          quote_fp_category: "raw_self_attack",
        })
      ),
    ]);

    expect(report.quoteFpByCategory.raw_self_attack).toBe(0);
  });

  it("produces PASS/FAIL gate semantics and fails on low metrics", () => {
    const messageReport = computeMetrics([
      evaluateExample(
        makeEntry({
          id: "gate-fail-1",
          text: "I hate myself for doing this again",
          family_label: "inner_critic",
          quote_label: "unsuitable",
          quote_fp_category: "raw_self_attack",
        })
      ),
      evaluateExample(
        makeEntry({
          id: "gate-fail-2",
          text: "What is anxiety?",
          behavioral_label: "non_behavioral",
          family_label: "none",
          quote_label: "unsuitable",
          should_abstain: true,
        })
      ),
    ]);

    const groupedMetrics = computeGroupMetrics([
      {
        group: makeGroup({
          id: "gate-group",
          expected_behavioral: false,
          expected_abstain: true,
          expected_quote_safe: false,
          expected_families: {
            trigger_condition: false,
            inner_critic: false,
            repetitive_loop: false,
            recovery_stabilizer: false,
          },
        }),
        behavioral: true,
        emittedFamilies: {
          trigger_condition: true,
          inner_critic: false,
          repetitive_loop: false,
          recovery_stabilizer: false,
        },
        anyClaimed: true,
        quoteSafe: true,
        behavioralCorrect: false,
        familiesCorrect: false,
        abstainCorrect: false,
        quoteSafeCorrect: false,
        falsePositiveFamilies: ["trigger_condition"],
        falseNegativeFamilies: [],
        clueQuotes: {
          trigger_condition: [],
          inner_critic: [],
          repetitive_loop: [],
          recovery_stabilizer: [],
        },
        visibleAbstentionScores: [],
        reviewFlag: {
          groupId: "gate-fail-1",
          emittedFamilies: ["trigger_condition" as const],
          review_needed: false,
          review_priority: null,
          review_reasons: [],
          faithfulnessIncluded: false,
        },
      },
    ]);

    const gates = runRegressionGates(messageReport, groupedMetrics, {
      totalCompared: 2,
      parsedCount: 1,
      parseFailures: 1,
      parseFailureRate: 0.5,
      abstained: 1,
      abstentionRate: 0.5,
      disagreementCount: 1,
      disagreementRate: 0.5,
      malformedAcceptedCount: 1,
      authoritativeViolations: 1,
      helpedWhereHeuristicsAbstained: 0,
      overreachedWhereHeuristicsAbstained: 0,
      familyMetrics: [
        { family: "trigger_condition", support: 1, predicted: 1, precision: 0, recall: 0 },
        { family: "inner_critic", support: 1, predicted: 1, precision: 0, recall: 0 },
      ],
      disagreements: [
        {
          entryId: "gate-fail-1",
          text: "I hate myself for doing this again",
          goldLabel: "inner_critic",
          heuristicLabel: "inner_critic",
          llmLabel: "abstain",
          parseStatus: "parsed",
          rationale: "too uncertain",
        },
      ],
      falsePositiveExamples: [],
      helpfulExamples: [],
      overreachExamples: [],
      parseFailureExamples: [
        { entryId: "gate-fail-2", parseStatus: "malformed_json", rationale: "bad json" },
      ],
    });
    expect(gates.allPassed).toBe(false);
    expect(gates.gates.some((gate) => gate.passed === false)).toBe(true);
  });

  it("documents the expected regression thresholds", () => {
    expect(REGRESSION_THRESHOLDS.BEHAVIORAL_PRECISION_FLOOR).toBe(0.95);
    expect(REGRESSION_THRESHOLDS.ABSTENTION_RATE_FLOOR).toBe(0.95);
    expect(REGRESSION_THRESHOLDS.QUOTE_PRECISION_FLOOR).toBe(0.8);
  });

  it("makes LLM LF disagreements inspectable side-by-side with heuristics", () => {
    const comparison = compareLlmLfOutputs(
      [
        makeEntry({
          id: "llm-compare-1",
          text: "I'm not sure I can handle this, and I always overthink every decision.",
          family_label: "inner_critic",
        }),
      ],
      [
        {
          entryId: "llm-compare-1",
          modelId: "gpt-4o-mini",
          promptVersion: "pattern-llm-lf-v1",
          label: "abstain",
          rationale: "Too uncertain to label safely.",
          confidence: 0.22,
          abstain: true,
          parseStatus: "parsed",
          shadowMode: true,
          usedForProductDecision: false,
        },
      ]
    );

    expect(comparison.disagreementCount).toBe(1);
    expect(comparison.disagreements[0]?.heuristicLabel).toBe("inner_critic");
    expect(comparison.disagreements[0]?.llmLabel).toBe("abstain");
    expect(comparison.disagreements.length).toBeGreaterThan(0);
  });

  it("tracks helpful and overreaching LLM LF cases where heuristics abstain", () => {
    const comparison = compareLlmLfOutputs(
      loadMessageDataset(),
      loadLlmLfShadowDataset()
    );

    expect(comparison.helpedWhereHeuristicsAbstained).toBeGreaterThanOrEqual(1);
    expect(comparison.overreachedWhereHeuristicsAbstained).toBeGreaterThanOrEqual(1);
    expect(comparison.falsePositiveExamples.length).toBeGreaterThanOrEqual(1);
    expect(comparison.parseFailureExamples.length).toBeGreaterThanOrEqual(1);
    expect(comparison.parseFailures).toBeGreaterThanOrEqual(1);
  });
});

// ── H. Grouped per-family emission regression gates (Phase 11) ───────────────

describe("grouped per-family emission regression gates", () => {
  /** Builds a GroupMetrics with specific precision/recall injected for one family. */
  function withEmission(
    family: "trigger_condition" | "inner_critic" | "repetitive_loop" | "recovery_stabilizer",
    precision: number | null,
    recall: number | null
  ) {
    const base = computeGroupMetrics([]);
    const familyEmission = { ...base.familyEmission };
    familyEmission[family] = { ...familyEmission[family], precision, recall };
    return { ...base, familyEmission };
  }

  it("REGRESSION_THRESHOLDS includes all 8 grouped family floor constants", () => {
    expect(REGRESSION_THRESHOLDS.GROUPED_TC_PRECISION_FLOOR).toBe(0.70);
    expect(REGRESSION_THRESHOLDS.GROUPED_TC_RECALL_FLOOR).toBe(0.60);
    expect(REGRESSION_THRESHOLDS.GROUPED_IC_PRECISION_FLOOR).toBe(0.40);
    expect(REGRESSION_THRESHOLDS.GROUPED_IC_RECALL_FLOOR).toBe(0.25);
    expect(REGRESSION_THRESHOLDS.GROUPED_RL_PRECISION_FLOOR).toBe(0.70);
    expect(REGRESSION_THRESHOLDS.GROUPED_RL_RECALL_FLOOR).toBe(0.70);
    expect(REGRESSION_THRESHOLDS.GROUPED_RS_PRECISION_FLOOR).toBe(0.70);
    expect(REGRESSION_THRESHOLDS.GROUPED_RS_RECALL_FLOOR).toBe(0.70);
  });

  it("all 8 family emission gate names are present in runRegressionGates output", () => {
    const { gates } = runRegressionGates(computeMetrics([]), computeGroupMetrics([]));
    const names = new Set(gates.map((g) => g.name));
    const expected = [
      "grouped_trigger_condition_precision_floor",
      "grouped_trigger_condition_recall_floor",
      "grouped_inner_critic_precision_floor",
      "grouped_inner_critic_recall_floor",
      "grouped_repetitive_loop_precision_floor",
      "grouped_repetitive_loop_recall_floor",
      "grouped_recovery_stabilizer_precision_floor",
      "grouped_recovery_stabilizer_recall_floor",
    ];
    for (const name of expected) {
      expect(names.has(name)).toBe(true);
    }
  });

  it("null precision/recall passes (null-safe — no expected positives)", () => {
    // computeGroupMetrics([]) → all families have null precision/recall (safeDiv 0/0)
    const { gates } = runRegressionGates(computeMetrics([]), computeGroupMetrics([]));
    const familyGates = gates.filter(
      (g) =>
        (g.name.endsWith("_precision_floor") || g.name.endsWith("_recall_floor")) &&
        g.name.startsWith("grouped_")
    );
    expect(familyGates.length).toBe(8);
    for (const gate of familyGates) {
      expect(gate.passed).toBe(true);
    }
  });

  it("TC precision gate fails when precision drops below floor", () => {
    const gm = withEmission("trigger_condition", 0.30, 0.90);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_trigger_condition_precision_floor")?.passed).toBe(false);
    expect(gates.find((g) => g.name === "grouped_trigger_condition_recall_floor")?.passed).toBe(true);
  });

  it("TC recall gate fails when recall drops below floor", () => {
    const gm = withEmission("trigger_condition", 0.90, 0.10);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_trigger_condition_precision_floor")?.passed).toBe(true);
    expect(gates.find((g) => g.name === "grouped_trigger_condition_recall_floor")?.passed).toBe(false);
  });

  it("IC precision gate fails when precision drops below floor", () => {
    const gm = withEmission("inner_critic", 0.10, 0.50);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_inner_critic_precision_floor")?.passed).toBe(false);
  });

  it("IC recall gate fails when recall drops below floor", () => {
    const gm = withEmission("inner_critic", 0.80, 0.10);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_inner_critic_recall_floor")?.passed).toBe(false);
  });

  it("RL precision gate fails when precision drops below floor", () => {
    const gm = withEmission("repetitive_loop", 0.10, 0.90);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_repetitive_loop_precision_floor")?.passed).toBe(false);
  });

  it("RL recall gate fails when recall drops below floor", () => {
    const gm = withEmission("repetitive_loop", 0.90, 0.10);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_repetitive_loop_recall_floor")?.passed).toBe(false);
  });

  it("RS precision gate fails when precision drops below floor", () => {
    const gm = withEmission("recovery_stabilizer", 0.10, 0.90);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_recovery_stabilizer_precision_floor")?.passed).toBe(false);
  });

  it("RS recall gate fails when recall drops below floor", () => {
    const gm = withEmission("recovery_stabilizer", 0.90, 0.10);
    const { gates } = runRegressionGates(computeMetrics([]), gm);
    expect(gates.find((g) => g.name === "grouped_recovery_stabilizer_recall_floor")?.passed).toBe(false);
  });

  it("all 8 gates pass on the repo-local grouped dataset (current baseline)", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const familyGateNames = [
      "grouped_trigger_condition_precision_floor",
      "grouped_trigger_condition_recall_floor",
      "grouped_inner_critic_precision_floor",
      "grouped_inner_critic_recall_floor",
      "grouped_repetitive_loop_precision_floor",
      "grouped_repetitive_loop_recall_floor",
      "grouped_recovery_stabilizer_precision_floor",
      "grouped_recovery_stabilizer_recall_floor",
    ];
    for (const name of familyGateNames) {
      const gate = report.regressionGates.find((g) => g.name === name);
      expect(gate?.passed).toBe(true);
    }
  });
});

// ── G. shouldRunFaithfulnessScoring guard behavior ────────────────────────────

describe("G. shouldRunFaithfulnessScoring guard behavior", () => {
  const OLD_ENV = process.env;

  // Restore env after each test so they stay isolated.
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("G-A: returns false when MINDLAB_FAITHFULNESS_SCORING is not set", () => {
    process.env = { ...OLD_ENV };
    delete process.env.MINDLAB_FAITHFULNESS_SCORING;
    delete process.env.OPENAI_API_KEY;

    expect(shouldRunFaithfulnessScoring()).toBe(false);
  });

  it("G-B: returns false when flag is set but OPENAI_API_KEY is absent", () => {
    process.env = { ...OLD_ENV, MINDLAB_FAITHFULNESS_SCORING: "1" };
    delete process.env.OPENAI_API_KEY;

    expect(shouldRunFaithfulnessScoring()).toBe(false);
  });

  it("G-B2: returns false when flag is 'true' but OPENAI_API_KEY is empty string", () => {
    process.env = { ...OLD_ENV, MINDLAB_FAITHFULNESS_SCORING: "true", OPENAI_API_KEY: "" };

    expect(shouldRunFaithfulnessScoring()).toBe(false);
  });

  it("G-C: returns true when flag is '1' and OPENAI_API_KEY is present", () => {
    process.env = { ...OLD_ENV, MINDLAB_FAITHFULNESS_SCORING: "1", OPENAI_API_KEY: "sk-test-key" };

    expect(shouldRunFaithfulnessScoring()).toBe(true);
  });

  it("G-C2: returns true when flag is 'true' (case-insensitive) and key is present", () => {
    process.env = { ...OLD_ENV, MINDLAB_FAITHFULNESS_SCORING: "TRUE", OPENAI_API_KEY: "sk-test-key" };

    expect(shouldRunFaithfulnessScoring()).toBe(true);
  });

  it("G-D: buildEvalReport with non-null faithfulnessReport propagates it to EvalReport.faithfulness", () => {
    const faithfulnessReport = computeFaithfulnessReport([]);
    const report = buildEvalReport(
      loadMessageDataset(),
      loadGroupedDataset(),
      undefined,
      undefined,
      faithfulnessReport
    );

    expect(report.faithfulness).not.toBeNull();
    expect(report.faithfulness?.scoredClaims).toBe(0);
    expect(report.faithfulness?.faithfulRate).toBeNull();
    // regression gate for faithfulness_floor should be present
    expect(report.regressionGates.some((g) => g.name === "faithfulness_floor")).toBe(true);
    expect(report.faithfulness?.regressionGate.threshold).toBe(FAITHFULNESS_FLOOR);
    expect(report.rationaleSufficiency).toBeNull();
  });

  it("G-E: buildEvalReport with null faithfulnessReport → no authority leak", () => {
    const report = buildEvalReport(
      loadMessageDataset(),
      loadGroupedDataset(),
      undefined,
      undefined,
      null
    );

    expect(report.faithfulness).toBeNull();
    expect(report.rationaleSufficiency).toBeNull();
    expect(report.rationaleMinimality).toBeNull();
    // No faithfulness_floor gate should appear when faithfulness is disabled
    expect(report.regressionGates.every((g) => g.name !== "faithfulness_floor")).toBe(true);
    expect(report.regressionGates.every((g) => g.name !== "rationale_sufficiency_floor")).toBe(true);
    expect(report.regressionGates.every((g) => g.name !== "rationale_minimality_floor")).toBe(true);
  });

  it("G-F: buildEvalReport includes rationaleSufficiency by default when faithfulness scores exist", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());

    expect(report.faithfulness).not.toBeNull();
    expect(report.rationaleSufficiency).not.toBeNull();
    expect(report.rationaleMinimality).not.toBeNull();
    expect(report.regressionGates.some((g) => g.name === "rationale_sufficiency_floor")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_faithfulness_stability_floor")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_parse_failure_ceiling")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_shadow_only")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_insufficiency_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_summary_stability_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_minimality_floor")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_minimality_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_comprehensiveness_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_minimality_shadow_only")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_global_minimality_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_alternative_support_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_subset_search_skip_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_unknown_minimality_visible")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_subset_search_coverage_floor")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_complement_search_coverage_floor")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_unknown_minimality_ceiling")).toBe(true);
    expect(report.regressionGates.some((g) => g.name === "rationale_unknown_alternative_support_ceiling")).toBe(true);
    expect(report.rationaleSufficiency?.totalClaimsConsidered).toBeGreaterThanOrEqual(
      report.rationaleSufficiency?.scoredClaims ?? 0
    );
    expect(report.rationaleSufficiency?.faithfulnessStableCount).toBeGreaterThanOrEqual(0);
    expect(report.rationaleSufficiency?.faithfulnessDriftCount).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.inspectableClaims.length).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.globallyMinimalClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.alternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.rationaleSubsetSearchSkippedClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.complementSubsetSearchSkippedClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.unknownMinimalityClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.unknownAlternativeSupportClaims).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.searchedRationaleSubsetRate).not.toBeNull();
    expect(report.rationaleMinimality?.searchedComplementSubsetRate).not.toBeNull();
    expect(report.rationaleMinimality?.meanChosenVsMinimalSubsetDelta).not.toBeNull();
    expect(report.rationaleMinimality?.competitiveAlternativeSupportRate).not.toBeNull();
    expect(report.rationaleMinimality?.totalRationaleSubsetChecks).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.totalComplementSubsetChecks).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.maxRationaleSubsetChecksPerClaim).toBeGreaterThanOrEqual(0);
    expect(report.rationaleMinimality?.maxComplementSubsetChecksPerClaim).toBeGreaterThanOrEqual(0);
  });
});

// ── I. Phase 12 dataset adequacy (grouped expansion + faithfulness baseline + calibration sufficiency) ──

describe("I. Phase 12 dataset adequacy", () => {
  it("I-A: grouped dataset loads cleanly and has expanded coverage", () => {
    const groups = loadGroupedDataset();
    expect(groups.length).toBeGreaterThanOrEqual(22);
    expect(groups.every((g) => validateAdjudicationGroup(g))).toBe(true);
  });

  it("I-B: grouped dataset covers all four active families as expected positives", () => {
    const groups = loadGroupedDataset();
    const tcPositive = groups.filter((g) => g.expected_families.trigger_condition);
    const icPositive = groups.filter((g) => g.expected_families.inner_critic);
    const rlPositive = groups.filter((g) => g.expected_families.repetitive_loop);
    const rsPositive = groups.filter((g) => g.expected_families.recovery_stabilizer);
    expect(tcPositive.length).toBeGreaterThanOrEqual(4);
    expect(icPositive.length).toBeGreaterThanOrEqual(4);
    expect(rlPositive.length).toBeGreaterThanOrEqual(2);
    expect(rsPositive.length).toBeGreaterThanOrEqual(4);
  });

  it("I-C: grouped dataset includes abstain/failure bundles across multiple shapes", () => {
    const groups = loadGroupedDataset();
    const abstainGroups = groups.filter((g) => g.expected_abstain);
    expect(abstainGroups.length).toBeGreaterThanOrEqual(5);
    // At least one abstain from each shape: topic-question TC, ambiguous RS, single-session RL, question RS
    const ids = new Set(abstainGroups.map((g) => g.id));
    expect(ids.has("tc-group-abstain")).toBe(true);
    expect(ids.has("rl-group-singlesession")).toBe(true);
    expect(ids.has("rl-insufficient-recurrence")).toBe(true);
    expect(ids.has("rs-fp-questions")).toBe(true);
  });

  it("I-D: faithfulness shadow dataset loads cleanly", () => {
    const rows = loadFaithfulnessShadowDataset();
    expect(rows.length).toBeGreaterThanOrEqual(13);
    expect(rows.every((r: unknown) => validateFaithfulnessShadowRecord(r))).toBe(true);
  });

  it("I-E: faithfulness shadow dataset covers all four active families", () => {
    const rows = loadFaithfulnessShadowDataset() as Array<{ family: string; faithful: boolean | null }>;
    const families = new Set(rows.map((r) => r.family));
    expect(families.has("trigger_condition")).toBe(true);
    expect(families.has("inner_critic")).toBe(true);
    expect(families.has("repetitive_loop")).toBe(true);
    expect(families.has("recovery_stabilizer")).toBe(true);
  });

  it("I-F: faithfulness shadow dataset contains faithful, unfaithful, and parse-failure cases", () => {
    const rows = loadFaithfulnessShadowDataset() as Array<{
      faithful: boolean | null;
      parseStatus: string;
      usedForProductDecision: boolean;
    }>;
    expect(rows.some((r) => r.faithful === true)).toBe(true);
    expect(rows.some((r) => r.faithful === false)).toBe(true);
    expect(rows.some((r) => r.parseStatus === "malformed_json")).toBe(true);
    expect(rows.some((r) => r.parseStatus === "schema_invalid")).toBe(true);
    // Product authority must remain false everywhere
    expect(rows.every((r) => r.usedForProductDecision === false)).toBe(true);
  });

  it("I-G: calibration eligible claim count meets the sufficiency floor after expansion", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const eligibleClaims = report.visibleCalibration?.eligibleClaims ?? 0;
    expect(eligibleClaims).toBeGreaterThanOrEqual(CALIBRATION_DATA_SUFFICIENCY_FLOOR);
  });

  it("I-H: visible_calibration_data_sufficient gate passes on expanded repo-local dataset", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const gate = report.regressionGates.find((g) => g.name === "visible_calibration_data_sufficient");
    expect(gate).toBeDefined();
    expect(gate?.passed).toBe(true);
  });

  it("I-I: visible_calibration_data_sufficient gate fails when eligible claims are below floor", () => {
    const msgReport = computeMetrics([]);
    const gm = computeGroupMetrics([]);
    // Synthetic calibration report with eligibleClaims below floor
    const tinyCalibration = {
      rows: [],
      eligibleClaims: 1,
      selectedThreshold: null,
      targetFailureRate: 0.25,
      selectedRow: null,
      policy: null,
    };
    const { gates } = runRegressionGates(msgReport, gm, null, null, null, tinyCalibration);
    const gate = gates.find((g: { name: string }) => g.name === "visible_calibration_data_sufficient");
    expect(gate?.passed).toBe(false);
    expect(CALIBRATION_DATA_SUFFICIENCY_FLOOR).toBe(8);
  });

  it("I-J: evaluator runs cleanly over entire expanded grouped dataset", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    expect(report.totalGroups).toBeGreaterThanOrEqual(22);
    expect(report.groupedMetrics.groupsEvaluated).toBeGreaterThanOrEqual(22);
  });

  it("I-K: new TC bundles produce scoreable visible claims (avoidance and pleasing shapes)", () => {
    const groups = loadGroupedDataset();
    const tcGroups = groups.filter(
      (g) =>
        g.expected_families.trigger_condition &&
        !g.expected_abstain &&
        g.id !== "tc-no-summary"
    );
    // Every emitting TC group (except tc-no-summary) should produce a visible claim
    const report = buildEvalReport(loadMessageDataset(), tcGroups);
    const tcEligible = (report.visibleCalibration?.eligibleClaims ?? 0);
    expect(tcEligible).toBeGreaterThanOrEqual(1);
  });

  it("I-L: no usedForProductDecision leaks introduced by new faithfulness records", () => {
    const rows = loadFaithfulnessShadowDataset() as Array<{ usedForProductDecision: boolean }>;
    expect(rows.every((r) => r.usedForProductDecision === false)).toBe(true);
  });
});
