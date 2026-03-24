import * as fs from "fs";
import * as path from "path";

import { evaluateGroup } from "./pattern-evaluator";
import type {
  ActiveFamily,
  EvalReport,
  FaithfulnessClaimScore,
  ReviewPriority,
  ReviewQueueArtifact,
  ReviewQueueItem,
  ReviewReason,
} from "./eval-types";
import { generateVisiblePatternSummary } from "../pattern-visible-summary";
import { loadMergedGroupedDataset } from "./pattern-review-resolution";

export const DEFAULT_REVIEW_QUEUE_JSON_PATH = path.join(
  process.cwd(),
  "eval/patterns/reports/review-queue.json"
);
export const DEFAULT_REVIEW_QUEUE_CSV_PATH = path.join(
  process.cwd(),
  "eval/patterns/reports/review-queue.csv"
);
export const REVIEW_QUEUE_ARTIFACT_VERSION = 1;

const PRIORITY_ORDER: Record<ReviewPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const REASON_SORT_WEIGHT: Record<ReviewReason, number> = {
  FAITHFULNESS_PARSE_FAILURE: 0,
  LOW_FAITHFULNESS: 1,
  LLM_HEURISTIC_DISAGREEMENT: 2,
  LLM_OVERREACH: 2,
  SURFACED_WITH_WEAK_SUPPORT: 3,
  NO_SAFE_VISIBLE_SUMMARY: 4,
  LOW_VISIBLE_COVERAGE: 5,
};

function buildReasonSeverityVector(reasons: ReviewReason[]): number[] {
  return [...new Set(reasons)].map((reason) => REASON_SORT_WEIGHT[reason]).sort((a, b) => a - b);
}

function compareReasons(a: ReviewReason[], b: ReviewReason[]): number {
  const aWeights = [...new Set(a)].map((reason) => REASON_SORT_WEIGHT[reason]).sort((x, y) => x - y);
  const bWeights = [...new Set(b)].map((reason) => REASON_SORT_WEIGHT[reason]).sort((x, y) => x - y);
  const max = Math.max(aWeights.length, bWeights.length);
  for (let i = 0; i < max; i++) {
    const aWeight = aWeights[i] ?? Number.POSITIVE_INFINITY;
    const bWeight = bWeights[i] ?? Number.POSITIVE_INFINITY;
    if (aWeight !== bWeight) return aWeight - bWeight;
  }
  if (a.length !== b.length) return b.length - a.length;
  return 0;
}

function buildFaithfulnessStatuses(
  allScores: FaithfulnessClaimScore[] | null,
  groupId: string
): ReviewQueueItem["faithfulness"] {
  const statuses = (allScores ?? [])
    .filter((score) => score.groupId === groupId)
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((score) => ({
      family: score.family,
      faithful: score.faithful,
      parseStatus: score.parseStatus,
      score: score.score,
    }));

  return {
    present: statuses.length > 0,
    statuses,
    hasLowFaithfulness: statuses.some((status) => status.faithful === false),
    hasParseFailure: statuses.some((status) => status.parseStatus !== "parsed"),
  };
}

function buildVisibleSummaryCandidates(
  groupResult: ReturnType<typeof evaluateGroup>,
  emittedFamilies: ActiveFamily[]
): ReviewQueueItem["visibleSummaryCandidates"] {
  return emittedFamilies
    .map((family) => {
      const scoreRecord = groupResult.visibleAbstentionScores.find((score) => score.family === family) ?? null;
      const summary = generateVisiblePatternSummary({
        patternType: family,
        persistedSummary: "",
        receipts: groupResult.clueQuotes[family].map((quote) => ({ quote })),
      });

      return {
        family,
        summary,
        score: scoreRecord?.score ?? null,
        triggered: scoreRecord?.triggered ?? null,
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family));
}

function buildLlmDisagreement(
  report: EvalReport,
  emittedFamilies: ActiveFamily[],
  reviewReasons: ReviewReason[]
): ReviewQueueItem["llmDisagreement"] {
  const llmFamilies = emittedFamilies.filter(
    (family) => family === "trigger_condition" || family === "inner_critic"
  );
  return {
    present: reviewReasons.includes("LLM_HEURISTIC_DISAGREEMENT") || reviewReasons.includes("LLM_OVERREACH"),
    families: llmFamilies,
    overreach: reviewReasons.includes("LLM_OVERREACH") && report.llmLfComparison !== null,
  };
}

export function sortReviewQueue(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return [...items].sort((a, b) => {
    const priorityCmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityCmp !== 0) return priorityCmp;

    const reasonCmp = compareReasons(a.reviewReasons, b.reviewReasons);
    if (reasonCmp !== 0) return reasonCmp;

    return a.groupId.localeCompare(b.groupId);
  });
}

function buildQueueSortKey(
  priority: ReviewPriority,
  reviewReasons: ReviewReason[],
  groupId: string
): string {
  const vector = buildReasonSeverityVector(reviewReasons).join(".");
  return `${PRIORITY_ORDER[priority]}|${vector}|${String(99 - reviewReasons.length).padStart(2, "0")}|${groupId}`;
}

export function buildReviewQueue(report: EvalReport): ReviewQueueItem[] {
  const flaggedGroups = report.reviewRouting?.flaggedGroups ?? [];
  if (flaggedGroups.length === 0) return [];

  const groupedEntries = loadMergedGroupedDataset(
    report.datasets.groupedLevelPath,
    report.datasets.groupedReviewedOverlayPath ?? undefined
  );
  const groupedResults = groupedEntries.map((group) => evaluateGroup(group));
  const groupedResultById = new Map(groupedResults.map((result) => [result.group.id, result]));
  const groupedEntryById = new Map(groupedEntries.map((group) => [group.id, group]));
  const faithfulnessScores = report.faithfulness?.unfaithfulClaims ?? null;

  const items: ReviewQueueItem[] = flaggedGroups.map((flag) => {
    const groupResult = groupedResultById.get(flag.groupId);
    const groupedEntry = groupedEntryById.get(flag.groupId);
    if (!groupResult || !groupedEntry || flag.review_priority === null) {
      throw new Error(`Missing grouped review context for groupId=${flag.groupId}`);
    }

    return {
      groupId: flag.groupId,
      priority: flag.review_priority,
      priorityRank: PRIORITY_ORDER[flag.review_priority],
      reviewReasons: [...flag.review_reasons],
      reasonSeverityVector: buildReasonSeverityVector(flag.review_reasons),
      sortKey: buildQueueSortKey(flag.review_priority, flag.review_reasons, flag.groupId),
      emittedFamilies: [...flag.emittedFamilies].sort((a, b) => a.localeCompare(b)),
      visibleSummaryCandidates: buildVisibleSummaryCandidates(groupResult, flag.emittedFamilies),
      faithfulness: buildFaithfulnessStatuses(faithfulnessScores, flag.groupId),
      llmDisagreement: buildLlmDisagreement(report, flag.emittedFamilies, flag.review_reasons),
      weakSupport: flag.review_reasons.includes("SURFACED_WITH_WEAK_SUPPORT"),
      quoteSafe: groupResult.quoteSafe,
      expectedAbstain: groupedEntry.expected_abstain,
      expectedQuoteSafe: groupedEntry.expected_quote_safe,
      sourceDescription: groupedEntry.description,
      sourceAnnotations: {
        fromReviewRouting: true,
        fromFaithfulness: (faithfulnessScores ?? []).some((score) => score.groupId === flag.groupId),
        fromLlmComparison:
          report.llmLfComparison?.disagreements.some((entry) => entry.entryId.startsWith(flag.groupId)) ??
          false,
        fromGroupedReplay: true,
      },
    };
  });

  return sortReviewQueue(items);
}

export function summarizeReviewQueueArtifact(
  artifact: Pick<ReviewQueueArtifact, "items">
): ReviewQueueArtifact["summary"] {
  const countsByPriority: Record<ReviewPriority, number> = { high: 0, medium: 0, low: 0 };
  const countsByReason: Partial<Record<ReviewReason, number>> = {};
  for (const item of artifact.items) {
    countsByPriority[item.priority] += 1;
    for (const reason of item.reviewReasons) {
      countsByReason[reason] = (countsByReason[reason] ?? 0) + 1;
    }
  }
  return {
    totalItems: artifact.items.length,
    countsByPriority,
    countsByReason,
    multiFamilyItemCount: artifact.items.filter((item) => item.emittedFamilies.length > 1).length,
    faithfulnessParseFailureItems: artifact.items.filter((item) => item.faithfulness.hasParseFailure).length,
    weakSupportItems: artifact.items.filter((item) => item.weakSupport).length,
    llmDisagreementItems: artifact.items.filter((item) => item.llmDisagreement.present).length,
    noVisibleSummaryCandidateItems: artifact.items.filter((item) =>
      item.visibleSummaryCandidates.some((candidate) => candidate.summary === null)
    ).length,
    quoteSafeFalseItems: artifact.items.filter((item) => !item.quoteSafe).length,
  };
}

export function assessReviewQueueCompleteness(
  artifact: Pick<ReviewQueueArtifact, "items">,
  report: EvalReport
): ReviewQueueArtifact["completeness"] {
  const flaggedGroupIds = new Set((report.reviewRouting?.flaggedGroups ?? []).map((flag) => flag.groupId));
  const itemIds = artifact.items.map((item) => item.groupId);
  const uniqueItemIds = new Set(itemIds);
  const everyFlaggedGroupAppearsExactlyOnce =
    flaggedGroupIds.size === artifact.items.length &&
    artifact.items.every((item) => itemIds.filter((id) => id === item.groupId).length === 1) &&
    [...flaggedGroupIds].every((id) => uniqueItemIds.has(id));
  const noNonFlaggedGroupsAppear = artifact.items.every((item) => flaggedGroupIds.has(item.groupId));
  const allGroupIdsResolvable = artifact.items.every((item) => typeof item.groupId === "string" && item.groupId.length > 0);
  const emittedFamilyOrderingDeterministic = artifact.items.every((item) =>
    item.emittedFamilies.every((family, index, families) => index === 0 || families[index - 1]!.localeCompare(family) <= 0)
  );
  const nestedOrderingDeterministic = artifact.items.every((item) =>
    item.visibleSummaryCandidates.every(
      (candidate, index, candidates) =>
        index === 0 || candidates[index - 1]!.family.localeCompare(candidate.family) <= 0
    ) &&
    item.faithfulness.statuses.every(
      (status, index, statuses) =>
        index === 0 || statuses[index - 1]!.family.localeCompare(status.family) <= 0
    )
  );

  return {
    everyFlaggedGroupAppearsExactlyOnce,
    noNonFlaggedGroupsAppear,
    allGroupIdsResolvable,
    emittedFamilyOrderingDeterministic,
    nestedOrderingDeterministic,
    orderingChecksPassed:
      everyFlaggedGroupAppearsExactlyOnce &&
      noNonFlaggedGroupsAppear &&
      allGroupIdsResolvable &&
      emittedFamilyOrderingDeterministic &&
      nestedOrderingDeterministic,
  };
}

export function writeReviewQueueJson(
  artifact: ReviewQueueArtifact,
  outPath = DEFAULT_REVIEW_QUEUE_JSON_PATH
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

export function buildReviewQueueArtifact(report: EvalReport): ReviewQueueArtifact {
  const baseArtifact: Omit<ReviewQueueArtifact, "summary" | "completeness"> = {
    version: REVIEW_QUEUE_ARTIFACT_VERSION,
    generatedAt: report.generatedAt,
    sourceReportPath: report.datasets.reportPath,
    groupedDatasetPath: report.datasets.groupedLevelPath,
    items: buildReviewQueue(report),
  };
  return {
    ...baseArtifact,
    summary: summarizeReviewQueueArtifact(baseArtifact),
    completeness: assessReviewQueueCompleteness(baseArtifact, report),
  };
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function writeReviewQueueCsv(
  items: ReviewQueueItem[],
  outPath = DEFAULT_REVIEW_QUEUE_CSV_PATH
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const header = [
    "groupId",
    "priority",
    "reviewReasons",
    "emittedFamilies",
    "visibleSummaryCandidates",
    "faithfulnessStatuses",
    "hasLowFaithfulness",
    "hasParseFailure",
    "llmFamilies",
    "llmOverreach",
    "weakSupport",
    "quoteSafe",
    "expectedAbstain",
    "expectedQuoteSafe",
    "sourceDescription",
  ];

  const rows = items.map((item) => [
    item.groupId,
    item.priority,
    item.reviewReasons.join("|"),
    item.emittedFamilies.join("|"),
    item.visibleSummaryCandidates
      .map((candidate) => `${candidate.family}:${candidate.summary ?? ""}:${candidate.score ?? ""}:${candidate.triggered ?? ""}`)
      .join("|"),
    item.faithfulness.statuses
      .map((status) => `${status.family}:${status.faithful ?? ""}:${status.parseStatus}:${status.score ?? ""}`)
      .join("|"),
    String(item.faithfulness.hasLowFaithfulness),
    String(item.faithfulness.hasParseFailure),
    item.llmDisagreement.families.join("|"),
    String(item.llmDisagreement.overreach),
    String(item.weakSupport),
    String(item.quoteSafe),
    String(item.expectedAbstain),
    String(item.expectedQuoteSafe),
    item.sourceDescription,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n") + "\n";

  fs.writeFileSync(outPath, csv, "utf-8");
}
