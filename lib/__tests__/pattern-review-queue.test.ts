import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, expect, it } from "vitest";

import type {
  EvalReport,
  ReviewQueueItem,
} from "../eval/eval-types";
import {
  assessReviewQueueCompleteness,
  buildReviewQueueArtifact,
  buildReviewQueue,
  sortReviewQueue,
  writeReviewQueueCsv,
  writeReviewQueueJson,
  REVIEW_QUEUE_ARTIFACT_VERSION,
} from "../eval/pattern-review-queue";
import { buildEvalReport, loadGroupedDataset, loadMessageDataset } from "../../scripts/eval-patterns";

function makeQueueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    groupId: "grp-default",
    priority: "low",
    priorityRank: 2,
    reviewReasons: ["NO_SAFE_VISIBLE_SUMMARY"],
    reasonSeverityVector: [4],
    sortKey: "2|4|98|grp-default",
    emittedFamilies: ["trigger_condition"],
    visibleSummaryCandidates: [
      {
        family: "trigger_condition",
        summary: null,
        score: null,
        triggered: null,
      },
    ],
    faithfulness: {
      present: false,
      statuses: [],
      hasLowFaithfulness: false,
      hasParseFailure: false,
    },
    llmDisagreement: {
      present: false,
      families: [],
      overreach: false,
    },
    weakSupport: false,
    quoteSafe: false,
    expectedAbstain: false,
    expectedQuoteSafe: false,
    sourceDescription: "test item",
    sourceAnnotations: {
      fromReviewRouting: true,
      fromFaithfulness: false,
      fromLlmComparison: false,
      fromGroupedReplay: true,
    },
    ...overrides,
  };
}

function makeMinimalReport(overrides: Partial<EvalReport> = {}): EvalReport {
  return {
    generatedAt: "2026-03-18T00:00:00.000Z",
    datasets: {
      messageLevelPath: "/tmp/messages.jsonl",
      groupedLevelPath: path.join(process.cwd(), "eval/patterns/adjudication-groups.jsonl"),
      groupedReviewedOverlayPath: null,
      llmLfShadowPath: null,
      faithfulnessShadowPath: null,
      faithfulnessReviewedOverlayPath: null,
      reportPath: "/tmp/latest.json",
    },
    totalExamples: 0,
    totalGroups: 0,
    sourceBreakdown: {
      live_user: 0,
      imported_user: 0,
      synthetic_edge_case: 0,
    },
    labelBreakdown: {
      behavioral: 0,
      non_behavioral: 0,
      by_family: {
        trigger_condition: 0,
        inner_critic: 0,
        repetitive_loop: 0,
        recovery_stabilizer: 0,
        none: 0,
      },
      should_abstain: 0,
    },
    behavioral: {
      precision: null,
      recall: null,
      f1: null,
      predictedBehavioral: 0,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
    },
    families: [],
    rlSessionGate: {
      rlLabeledCount: 0,
      sessionCount: 0,
      detectorFired: false,
      singleSessionGateBlocks: false,
    },
    quote: {
      predictedSafe: 0,
      precision: null,
      recall: null,
      abstentionOnShouldAbstain: null,
    },
    abstention: {
      shouldAbstainCount: 0,
      correctlyAbstained: 0,
      rate: null,
    },
    quoteFpByCategory: {
      raw_self_attack: 0,
      too_long: 0,
      vague_or_generic: 0,
      assistant_directed: 0,
      structured_or_pasted: 0,
      borderline_first_person: 0,
      topic_or_question: 0,
      other: 0,
    },
    falsePredictions: {
      behavioralFP: [],
      familyFP: [],
      quoteFP: [],
    },
    groupedMetrics: {
      groupsEvaluated: 0,
      behavioralExpected: 0,
      behavioralPredicted: 0,
      behavioralCorrect: 0,
      exactFamilyMatches: 0,
      abstentionTotal: 0,
      abstentionCorrect: 0,
      abstentionRate: null,
      quoteSafePredicted: 0,
      quoteSafeExpected: 0,
      quotePrecision: null,
      quoteRecall: null,
      quotePresenceCorrect: 0,
      quotePresenceTotal: 0,
      familyEmission: {
        trigger_condition: { expected: 0, emitted: 0, truePositive: 0, falsePositive: 0, falseNegative: 0, precision: null, recall: null },
        inner_critic: { expected: 0, emitted: 0, truePositive: 0, falsePositive: 0, falseNegative: 0, precision: null, recall: null },
        repetitive_loop: { expected: 0, emitted: 0, truePositive: 0, falsePositive: 0, falseNegative: 0, precision: null, recall: null },
        recovery_stabilizer: { expected: 0, emitted: 0, truePositive: 0, falsePositive: 0, falseNegative: 0, precision: null, recall: null },
      },
      falsePositiveBundles: [],
      falseNegativeBundles: [],
    },
    visibleAbstention: {
      totalEmittedClaims: 0,
      totalSurfaced: 0,
      totalAbstained: 0,
      coverageRate: null,
      abstentionRate: null,
      scoreDistribution: { min: null, max: null, mean: null },
      conditionalFaithfulnessRate: null,
      abstentionThreshold: 0.55,
    },
    llmLfComparison: null,
    regressionGates: [],
    allRegressionGatesPassed: true,
    faithfulness: null,
    rationaleSufficiency: null,
    rationaleMinimality: null,
    reviewRouting: {
      totalGroups: 0,
      flaggedCount: 0,
      flaggedRate: null,
      priorityDistribution: { high: 0, medium: 0, low: 0 },
      reasonDistribution: {},
      flaggedGroups: [],
      faithfulnessIncluded: false,
    },
    visibleCalibration: null,
    ...overrides,
  };
}

describe("pattern review queue", () => {
  it("all flagged groups appear exactly once and non-flagged groups are absent", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const queue = buildReviewQueue(report);
    const flaggedIds = report.reviewRouting?.flaggedGroups.map((group) => group.groupId) ?? [];

    expect(queue.map((item) => item.groupId)).toEqual([...new Set(flaggedIds)].sort((a, b) => {
      const aItem = queue.find((item) => item.groupId === a)!;
      const bItem = queue.find((item) => item.groupId === b)!;
      return sortReviewQueue([aItem, bItem])[0]!.groupId === a ? -1 : 1;
    }));
    expect(new Set(queue.map((item) => item.groupId)).size).toBe(queue.length);
    expect(queue.every((item) => flaggedIds.includes(item.groupId))).toBe(true);
  });

  it("priority ordering is deterministic and parse failure sorts before low faithfulness", () => {
    const sorted = sortReviewQueue([
      makeQueueItem({ groupId: "grp-low-faith", priority: "high", reviewReasons: ["LOW_FAITHFULNESS"] }),
      makeQueueItem({ groupId: "grp-parse", priority: "high", reviewReasons: ["FAITHFULNESS_PARSE_FAILURE"] }),
      makeQueueItem({ groupId: "grp-weak", priority: "medium", reviewReasons: ["SURFACED_WITH_WEAK_SUPPORT"] }),
    ]);

    expect(sorted.map((item) => item.groupId)).toEqual([
      "grp-parse",
      "grp-low-faith",
      "grp-weak",
    ]);
  });

  it("more severe and more numerous reasons sort earlier, with groupId as final tie-break", () => {
    const sorted = sortReviewQueue([
      makeQueueItem({ groupId: "grp-b", priority: "medium", reviewReasons: ["LLM_HEURISTIC_DISAGREEMENT"] }),
      makeQueueItem({ groupId: "grp-a", priority: "medium", reviewReasons: ["LLM_HEURISTIC_DISAGREEMENT"] }),
      makeQueueItem({ groupId: "grp-many", priority: "medium", reviewReasons: ["LLM_HEURISTIC_DISAGREEMENT", "NO_SAFE_VISIBLE_SUMMARY"] }),
    ]);

    expect(sorted.map((item) => item.groupId)).toEqual([
      "grp-many",
      "grp-a",
      "grp-b",
    ]);
  });

  it("JSON export is stable across runs and CSV row count matches", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const queueA = buildReviewQueue(report);
    const artifactA = buildReviewQueueArtifact(report);
    const artifactB = buildReviewQueueArtifact(report);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-review-queue-"));
    const jsonA = path.join(tempDir, "review-queue-a.json");
    const jsonB = path.join(tempDir, "review-queue-b.json");
    const csvPath = path.join(tempDir, "review-queue.csv");

    writeReviewQueueJson(artifactA, jsonA);
    writeReviewQueueJson(artifactB, jsonB);
    writeReviewQueueCsv(queueA, csvPath);

    expect(fs.readFileSync(jsonA, "utf-8")).toBe(fs.readFileSync(jsonB, "utf-8"));
    expect(artifactA.version).toBe(REVIEW_QUEUE_ARTIFACT_VERSION);
    expect(artifactA.generatedAt).toBe(report.generatedAt);
    expect(artifactA.sourceReportPath).toBe(report.datasets.reportPath);
    expect(artifactA.groupedDatasetPath).toBe(report.datasets.groupedLevelPath);
    expect(artifactA.summary.totalItems).toBe(queueA.length);
    expect(artifactA.completeness.orderingChecksPassed).toBe(true);
    expect(artifactA.items).toEqual(queueA);

    const csvLines = fs.readFileSync(csvPath, "utf-8").trimEnd().split("\n");
    expect(csvLines.length - 1).toBe(queueA.length);
  });

  it("queue fields agree with reviewRouting and grouped results, and multi-family groups stay one row", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const queue = buildReviewQueue(report);
    const mixed = queue.find((item) => item.groupId === "mixed-bundle");

    expect(mixed).toBeDefined();
    expect(mixed?.priority).toBe(
      report.reviewRouting?.flaggedGroups.find((group) => group.groupId === "mixed-bundle")?.review_priority
    );
    expect(mixed?.reviewReasons).toEqual(
      report.reviewRouting?.flaggedGroups.find((group) => group.groupId === "mixed-bundle")?.review_reasons
    );
    expect(mixed?.emittedFamilies.length).toBeGreaterThan(1);
    expect(mixed?.priorityRank).toBe(0);
    expect(mixed?.sourceAnnotations.fromReviewRouting).toBe(true);
    expect(Array.isArray(mixed?.reasonSeverityVector)).toBe(true);
    expect(typeof mixed?.sortKey).toBe("string");
    expect(queue.filter((item) => item.groupId === "mixed-bundle")).toHaveLength(1);
  });

  it("sort metadata and source annotations are deterministic and populated", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const artifactA = buildReviewQueueArtifact(report);
    const artifactB = buildReviewQueueArtifact(report);
    const itemA = artifactA.items[0]!;
    const itemB = artifactB.items[0]!;

    expect(itemA.sortKey).toBe(itemB.sortKey);
    expect(itemA.reasonSeverityVector).toEqual(itemB.reasonSeverityVector);
    expect(itemA.sourceAnnotations.fromReviewRouting).toBe(true);
    expect(itemA.sourceAnnotations.fromGroupedReplay).toBe(true);
  });

  it("completeness detects missing or duplicated flagged groups in synthetic artifacts", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset());
    const artifact = buildReviewQueueArtifact(report);
    const missingArtifact = {
      items: artifact.items.slice(1),
    };
    const duplicatedArtifact = {
      items: [artifact.items[0]!, ...artifact.items],
    };

    expect(assessReviewQueueCompleteness(missingArtifact, report).orderingChecksPassed).toBe(
      false
    );
    expect(
      assessReviewQueueCompleteness(duplicatedArtifact, report).everyFlaggedGroupAppearsExactlyOnce
    ).toBe(false);
  });

  it("empty queue exports valid empty artifacts", () => {
    const report = makeMinimalReport();
    const queue = buildReviewQueue(report);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlab-review-empty-"));
    const jsonPath = path.join(tempDir, "review-queue.json");
    const csvPath = path.join(tempDir, "review-queue.csv");

    writeReviewQueueJson(buildReviewQueueArtifact(report), jsonPath);
    writeReviewQueueCsv(queue, csvPath);

    expect(queue).toEqual([]);
    expect(JSON.parse(fs.readFileSync(jsonPath, "utf-8")).items).toEqual([]);
    expect(fs.readFileSync(csvPath, "utf-8").trim()).toContain("groupId,priority");
  });

  it("does not crash when faithfulness is null", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset(), undefined, undefined, null, null);
    expect(() => buildReviewQueue(report)).not.toThrow();
  });

  it("does not crash when llmLfComparison is null", () => {
    const report = buildEvalReport(loadMessageDataset(), loadGroupedDataset(), undefined, []);
    expect(() => buildReviewQueue(report)).not.toThrow();
  });
});
