import * as fs from "fs";
import * as path from "path";

import { validateAdjudicationGroup } from "./pattern-evaluator";
import type {
  AdjudicationGroup,
  FaithfulnessClaimScore,
  ReviewMetadata,
  ReviewedAdjudicationGroup,
  ReviewedFaithfulnessClaimScore,
  ReviewResolutionOutcome,
  ReviewResolutionRecord,
} from "./eval-types";

export const REVIEW_RESOLUTION_VERSION = 1;
export const DEFAULT_REVIEW_RESOLUTIONS_PATH = path.join(
  process.cwd(),
  "eval/patterns/review-resolutions.jsonl"
);
export const DEFAULT_REVIEWED_GROUPED_DATASET_PATH = path.join(
  process.cwd(),
  "eval/patterns/adjudication-groups.reviewed.jsonl"
);
export const DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH = path.join(
  process.cwd(),
  "eval/patterns/faithfulness-shadow-reviewed.jsonl"
);
export const DEFAULT_REVIEW_PROMOTION_SUMMARY_PATH = path.join(
  process.cwd(),
  "eval/patterns/reports/review-promotion-summary.json"
);

function readJsonl(pathname: string): unknown[] {
  if (!fs.existsSync(pathname)) return [];
  const raw = fs.readFileSync(pathname, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function writeJsonl(pathname: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(pathname, rows.length > 0 ? `${body}\n` : "", "utf-8");
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return typeof value === "object" && value !== null;
}

function isActiveFamily(value: unknown): value is FaithfulnessClaimScore["family"] {
  return (
    value === "trigger_condition" ||
    value === "inner_critic" ||
    value === "repetitive_loop" ||
    value === "recovery_stabilizer"
  );
}

function validateReviewMetadata(value: unknown): value is ReviewMetadata {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["sourceQueueRun"] === "string" &&
    row["sourceQueueRun"].length > 0 &&
    typeof row["reviewedAt"] === "string" &&
    row["reviewedAt"].length > 0 &&
    typeof row["reviewer"] === "string" &&
    row["reviewer"].length > 0 &&
    typeof row["resolutionReason"] === "string" &&
    row["resolutionReason"].length > 0 &&
    (row["resolutionStatus"] === "confirmed" || row["resolutionStatus"] === "modified")
  );
}

export function validateReviewResolutionRecord(obj: unknown): obj is ReviewResolutionRecord {
  if (typeof obj !== "object" || obj === null) return false;
  const row = obj as Record<string, unknown>;

  if (row["version"] !== REVIEW_RESOLUTION_VERSION) return false;
  if (typeof row["sourceQueueRun"] !== "string" || row["sourceQueueRun"].length === 0) return false;
  if (typeof row["reviewedAt"] !== "string" || row["reviewedAt"].length === 0) return false;
  if (typeof row["reviewer"] !== "string" || row["reviewer"].length === 0) return false;
  if (typeof row["resolutionReason"] !== "string" || row["resolutionReason"].length === 0) return false;
  if (typeof row["groupId"] !== "string" || row["groupId"].length === 0) return false;
  if (row["status"] !== "confirmed" && row["status"] !== "rejected" && row["status"] !== "modified") {
    return false;
  }

  const groupedResolution = row["groupedResolution"];
  if (groupedResolution !== undefined) {
    if (typeof groupedResolution !== "object" || groupedResolution === null) return false;
    const grouped = groupedResolution as Record<string, unknown>;
    if (grouped["description"] !== undefined && typeof grouped["description"] !== "string") return false;
    if (grouped["expected_behavioral"] !== undefined && typeof grouped["expected_behavioral"] !== "boolean") return false;
    if (grouped["expected_abstain"] !== undefined && typeof grouped["expected_abstain"] !== "boolean") return false;
    if (grouped["expected_quote_safe"] !== undefined && typeof grouped["expected_quote_safe"] !== "boolean") return false;
    if (grouped["expected_families"] !== undefined) {
      if (!isBooleanRecord(grouped["expected_families"])) return false;
      const families = grouped["expected_families"];
      if (typeof families["trigger_condition"] !== "boolean") return false;
      if (typeof families["inner_critic"] !== "boolean") return false;
      if (typeof families["repetitive_loop"] !== "boolean") return false;
      if (typeof families["recovery_stabilizer"] !== "boolean") return false;
    }
  }

  const faithfulnessResolutions = row["faithfulnessResolutions"];
  if (faithfulnessResolutions !== undefined) {
    if (!Array.isArray(faithfulnessResolutions)) return false;
    if (!faithfulnessResolutions.every((entry) => {
      if (typeof entry !== "object" || entry === null) return false;
      const faith = entry as Record<string, unknown>;
      return (
        isActiveFamily(faith["family"]) &&
        typeof faith["visibleSummary"] === "string" &&
        faith["visibleSummary"].length > 0 &&
        Array.isArray(faith["receiptQuotes"]) &&
        (faith["receiptQuotes"] as unknown[]).every((quote) => typeof quote === "string") &&
        (faith["faithful"] === true || faith["faithful"] === false || faith["faithful"] === null) &&
        (faith["score"] === null || typeof faith["score"] === "number") &&
        typeof faith["rationale"] === "string" &&
        (faith["parseStatus"] === "parsed" ||
          faith["parseStatus"] === "malformed_json" ||
          faith["parseStatus"] === "schema_invalid" ||
          faith["parseStatus"] === "request_failed") &&
        (faith["notes"] === undefined || typeof faith["notes"] === "string")
      );
    })) return false;
  }

  return true;
}

export function validateReviewedAdjudicationGroup(obj: unknown): obj is ReviewedAdjudicationGroup {
  if (!validateAdjudicationGroup(obj)) return false;
  return validateReviewMetadata((obj as Record<string, unknown>)["reviewMetadata"]);
}

export function validateFaithfulnessShadowRecord(obj: unknown): obj is FaithfulnessClaimScore {
  if (typeof obj !== "object" || obj === null) return false;
  const row = obj as Record<string, unknown>;
  if (typeof row["groupId"] !== "string" || row["groupId"].length === 0) return false;
  if (!isActiveFamily(row["family"])) return false;
  if (typeof row["visibleSummary"] !== "string" || row["visibleSummary"].length === 0) return false;
  if (!Array.isArray(row["receiptQuotes"]) || !(row["receiptQuotes"] as unknown[]).every((q) => typeof q === "string")) return false;
  if (row["faithful"] !== true && row["faithful"] !== false && row["faithful"] !== null) return false;
  if (row["score"] !== null && typeof row["score"] !== "number") return false;
  if (typeof row["rationale"] !== "string") return false;
  if (
    row["parseStatus"] !== "parsed" &&
    row["parseStatus"] !== "malformed_json" &&
    row["parseStatus"] !== "schema_invalid" &&
    row["parseStatus"] !== "request_failed"
  ) return false;
  if (row["shadowMode"] !== true) return false;
  if (typeof row["usedForProductDecision"] !== "boolean") return false;
  if (row["notes"] !== undefined && typeof row["notes"] !== "string") return false;
  return true;
}

export function validateReviewedFaithfulnessClaimScore(obj: unknown): obj is ReviewedFaithfulnessClaimScore {
  if (!validateFaithfulnessShadowRecord(obj)) return false;
  return validateReviewMetadata((obj as Record<string, unknown>)["reviewMetadata"]);
}

export function loadReviewResolutionRecords(
  resolutionsPath = DEFAULT_REVIEW_RESOLUTIONS_PATH
): ReviewResolutionRecord[] {
  const rows = readJsonl(resolutionsPath);
  const errors: string[] = [];
  const records: ReviewResolutionRecord[] = [];

  rows.forEach((row, index) => {
    if (!validateReviewResolutionRecord(row)) {
      errors.push(`Line ${index + 1}: invalid review resolution record`);
      return;
    }
    records.push(row);
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return records;
}

function readGroupedRows(datasetPath: string): AdjudicationGroup[] {
  if (!fs.existsSync(datasetPath)) return [];
  return readJsonl(datasetPath).filter(validateAdjudicationGroup);
}

function readReviewedGroupedRows(datasetPath: string): ReviewedAdjudicationGroup[] {
  if (!fs.existsSync(datasetPath)) return [];
  return readJsonl(datasetPath).filter(validateReviewedAdjudicationGroup);
}

function readFaithfulnessRows(datasetPath: string): FaithfulnessClaimScore[] {
  if (!fs.existsSync(datasetPath)) return [];
  return readJsonl(datasetPath).filter(validateFaithfulnessShadowRecord);
}

function readReviewedFaithfulnessRows(datasetPath: string): ReviewedFaithfulnessClaimScore[] {
  if (!fs.existsSync(datasetPath)) return [];
  return readJsonl(datasetPath).filter(validateReviewedFaithfulnessClaimScore);
}

function dedupeResolutionKey(record: ReviewResolutionRecord): string {
  return [
    record.sourceQueueRun,
    record.groupId,
    record.status,
    record.reviewedAt,
    record.reviewer,
    record.resolutionReason,
  ].join("|");
}

export function dedupeReviewResolutionRecords(
  records: ReviewResolutionRecord[]
): ReviewResolutionRecord[] {
  const seen = new Set<string>();
  const deduped: ReviewResolutionRecord[] = [];
  for (const record of records) {
    const key = dedupeResolutionKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }
  return deduped;
}

export type ReviewPromotionResolutionOutcome = {
  groupId: string;
  reviewedAt: string;
  reviewer: string;
  status: ReviewResolutionRecord["status"];
  outcome: ReviewResolutionOutcome;
};

export type ReviewPromotionResult = {
  groupedRows: ReviewedAdjudicationGroup[];
  faithfulnessRows: ReviewedFaithfulnessClaimScore[];
  duplicateResolutionCount: number;
  inputResolutionCount: number;
  validResolutionCount: number;
  rejectedResolutionCount: number;
  noPayloadCount: number;
  supersededGroupedCount: number;
  supersededFaithfulnessCount: number;
  invalidMissingBaseGroupCount: number;
  outcomes: ReviewPromotionResolutionOutcome[];
};

function compareByReviewedAtThenLexical<T extends { reviewMetadata: ReviewMetadata }>(
  a: T,
  b: T
): number {
  const timeCmp = a.reviewMetadata.reviewedAt.localeCompare(b.reviewMetadata.reviewedAt);
  if (timeCmp !== 0) return timeCmp;
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

export function promoteReviewResolutionsDetailed(
  records: ReviewResolutionRecord[],
  baseGroups: AdjudicationGroup[]
): ReviewPromotionResult {
  const deduped = dedupeReviewResolutionRecords(records);
  const duplicateResolutionCount = records.length - deduped.length;
  const baseGroupById = new Map(baseGroups.map((group) => [group.id, group]));

  const groupedCandidates: ReviewedAdjudicationGroup[] = [];
  const faithfulnessCandidates: ReviewedFaithfulnessClaimScore[] = [];
  const outcomes: ReviewPromotionResolutionOutcome[] = [];
  let rejectedResolutionCount = 0;
  let noPayloadCount = 0;
  let invalidMissingBaseGroupCount = 0;

  for (const record of deduped) {
    if (record.status === "rejected") {
      rejectedResolutionCount += 1;
      outcomes.push({
        groupId: record.groupId,
        reviewedAt: record.reviewedAt,
        reviewer: record.reviewer,
        status: record.status,
        outcome: "rejected_no_promotion",
      });
      continue;
    }
    if (!record.groupedResolution && !(record.faithfulnessResolutions?.length)) {
      noPayloadCount += 1;
      outcomes.push({
        groupId: record.groupId,
        reviewedAt: record.reviewedAt,
        reviewer: record.reviewer,
        status: record.status,
        outcome: "no_explicit_payload",
      });
      continue;
    }
    const reviewMetadata: ReviewMetadata = {
      sourceQueueRun: record.sourceQueueRun,
      reviewedAt: record.reviewedAt,
      reviewer: record.reviewer,
      resolutionReason: record.resolutionReason,
      resolutionStatus: record.status,
    };

    if (record.groupedResolution) {
      const baseGroup = baseGroupById.get(record.groupId);
      if (!baseGroup) {
        invalidMissingBaseGroupCount += 1;
        outcomes.push({
          groupId: record.groupId,
          reviewedAt: record.reviewedAt,
          reviewer: record.reviewer,
          status: record.status,
          outcome: "invalid_missing_base_group",
        });
        continue;
      }
      groupedCandidates.push({
        ...baseGroup,
        ...(record.groupedResolution.description !== undefined
          ? { description: record.groupedResolution.description }
          : {}),
        ...(record.groupedResolution.expected_behavioral !== undefined
          ? { expected_behavioral: record.groupedResolution.expected_behavioral }
          : {}),
        ...(record.groupedResolution.expected_families !== undefined
          ? { expected_families: record.groupedResolution.expected_families }
          : {}),
        ...(record.groupedResolution.expected_abstain !== undefined
          ? { expected_abstain: record.groupedResolution.expected_abstain }
          : {}),
        ...(record.groupedResolution.expected_quote_safe !== undefined
          ? { expected_quote_safe: record.groupedResolution.expected_quote_safe }
          : {}),
        reviewMetadata,
      });
    }

    for (const faithfulnessResolution of record.faithfulnessResolutions ?? []) {
      faithfulnessCandidates.push({
        groupId: record.groupId,
        family: faithfulnessResolution.family,
        visibleSummary: faithfulnessResolution.visibleSummary,
        receiptQuotes: [...faithfulnessResolution.receiptQuotes],
        faithful: faithfulnessResolution.faithful,
        score: faithfulnessResolution.score,
        rationale: faithfulnessResolution.rationale,
        parseStatus: faithfulnessResolution.parseStatus,
        shadowMode: true,
        usedForProductDecision: false,
        ...(faithfulnessResolution.notes !== undefined ? { notes: faithfulnessResolution.notes } : {}),
        reviewMetadata,
      });
    }

    const hasGrouped = Boolean(record.groupedResolution) && baseGroupById.has(record.groupId);
    const hasFaithfulness = Boolean(record.faithfulnessResolutions?.length);
    outcomes.push({
      groupId: record.groupId,
      reviewedAt: record.reviewedAt,
      reviewer: record.reviewer,
      status: record.status,
      outcome:
        hasGrouped && hasFaithfulness
          ? "grouped_and_faithfulness_promoted"
          : hasGrouped
            ? "grouped_promoted"
            : "faithfulness_promoted",
    });
  }

  const groupedById = new Map<string, ReviewedAdjudicationGroup>();
  let supersededGroupedCount = 0;
  for (const row of groupedCandidates) {
    const prev = groupedById.get(row.id);
    if (!prev || compareByReviewedAtThenLexical(prev, row) < 0) {
      if (prev) supersededGroupedCount += 1;
      groupedById.set(row.id, row);
    } else {
      supersededGroupedCount += 1;
    }
  }

  const faithfulnessByKey = new Map<string, ReviewedFaithfulnessClaimScore>();
  let supersededFaithfulnessCount = 0;
  for (const row of faithfulnessCandidates) {
    const key = `${row.groupId}:${row.family}`;
    const prev = faithfulnessByKey.get(key);
    if (!prev || compareByReviewedAtThenLexical(prev, row) < 0) {
      if (prev) supersededFaithfulnessCount += 1;
      faithfulnessByKey.set(key, row);
    } else {
      supersededFaithfulnessCount += 1;
    }
  }

  return {
    groupedRows: [...groupedById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    faithfulnessRows: [...faithfulnessByKey.values()].sort((a, b) =>
      `${a.groupId}:${a.family}`.localeCompare(`${b.groupId}:${b.family}`)
    ),
    duplicateResolutionCount,
    inputResolutionCount: records.length,
    validResolutionCount: deduped.length,
    rejectedResolutionCount,
    noPayloadCount,
    supersededGroupedCount,
    supersededFaithfulnessCount,
    invalidMissingBaseGroupCount,
    outcomes: outcomes.sort((a, b) =>
      `${a.groupId}:${a.reviewedAt}:${a.reviewer}`.localeCompare(
        `${b.groupId}:${b.reviewedAt}:${b.reviewer}`
      )
    ),
  };
}

export function promoteReviewResolutions(
  records: ReviewResolutionRecord[],
  baseGroups: AdjudicationGroup[]
): {
  groupedRows: ReviewedAdjudicationGroup[];
  faithfulnessRows: ReviewedFaithfulnessClaimScore[];
  duplicateResolutionCount: number;
} {
  const result = promoteReviewResolutionsDetailed(records, baseGroups);
  return {
    groupedRows: result.groupedRows,
    faithfulnessRows: result.faithfulnessRows,
    duplicateResolutionCount: result.duplicateResolutionCount,
  };
}

export function writeReviewedGroupedDataset(
  rows: ReviewedAdjudicationGroup[],
  outPath = DEFAULT_REVIEWED_GROUPED_DATASET_PATH
): void {
  writeJsonl(outPath, rows);
}

export function writeReviewedFaithfulnessDataset(
  rows: ReviewedFaithfulnessClaimScore[],
  outPath = DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH
): void {
  writeJsonl(outPath, rows);
}

export function writeReviewPromotionSummary(
  summary: Record<string, unknown>,
  outPath = DEFAULT_REVIEW_PROMOTION_SUMMARY_PATH
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n", "utf-8");
}

export function ensureReviewResolutionLog(
  resolutionsPath = DEFAULT_REVIEW_RESOLUTIONS_PATH
): void {
  fs.mkdirSync(path.dirname(resolutionsPath), { recursive: true });
  if (!fs.existsSync(resolutionsPath)) {
    fs.writeFileSync(resolutionsPath, "", "utf-8");
  }
}

export function loadMergedGroupedDataset(
  basePath: string,
  reviewedOverlayPath = DEFAULT_REVIEWED_GROUPED_DATASET_PATH
): AdjudicationGroup[] {
  const base = readGroupedRows(basePath);
  const reviewed = readReviewedGroupedRows(reviewedOverlayPath);
  const reviewedById = new Map(reviewed.map((row) => [row.id, row as AdjudicationGroup]));
  const merged: AdjudicationGroup[] = [];
  const seen = new Set<string>();

  for (const row of base) {
    merged.push(reviewedById.get(row.id) ?? row);
    seen.add(row.id);
  }

  for (const row of reviewed) {
    if (seen.has(row.id)) continue;
    merged.push(row);
  }

  return merged;
}

export function loadMergedFaithfulnessDataset(
  basePath: string,
  reviewedOverlayPath = DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH
): FaithfulnessClaimScore[] {
  const base = readFaithfulnessRows(basePath);
  const reviewed = readReviewedFaithfulnessRows(reviewedOverlayPath);
  const reviewedByKey = new Map(reviewed.map((row) => [`${row.groupId}:${row.family}`, row as FaithfulnessClaimScore]));
  const merged: FaithfulnessClaimScore[] = [];
  const seen = new Set<string>();

  for (const row of base) {
    const key = `${row.groupId}:${row.family}`;
    merged.push(reviewedByKey.get(key) ?? row);
    seen.add(key);
  }

  for (const row of reviewed) {
    const key = `${row.groupId}:${row.family}`;
    if (seen.has(key)) continue;
    merged.push(row);
  }

  return merged;
}
