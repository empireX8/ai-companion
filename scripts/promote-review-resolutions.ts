import { createHash } from "node:crypto";

import {
  DEFAULT_REVIEW_PROMOTION_SUMMARY_PATH,
  DEFAULT_REVIEW_RESOLUTIONS_PATH,
  DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH,
  DEFAULT_REVIEWED_GROUPED_DATASET_PATH,
  ensureReviewResolutionLog,
  loadReviewResolutionRecords,
  promoteReviewResolutionsDetailed,
  writeReviewedFaithfulnessDataset,
  writeReviewedGroupedDataset,
  writeReviewPromotionSummary,
} from "../lib/eval/pattern-review-resolution";
import { loadGroupedDataset } from "./eval-patterns";

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function runReviewPromotion(): {
  groupedRows: number;
  faithfulnessRows: number;
  duplicateResolutionCount: number;
} {
  ensureReviewResolutionLog(DEFAULT_REVIEW_RESOLUTIONS_PATH);
  const records = loadReviewResolutionRecords(DEFAULT_REVIEW_RESOLUTIONS_PATH);
  const baseGroups = loadGroupedDataset();
  const result = promoteReviewResolutionsDetailed(records, baseGroups);

  writeReviewedGroupedDataset(result.groupedRows, DEFAULT_REVIEWED_GROUPED_DATASET_PATH);
  writeReviewedFaithfulnessDataset(result.faithfulnessRows, DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH);

  const summaryPayload = {
      generatedAt: new Date().toISOString(),
      inputResolutionCount: result.inputResolutionCount,
      validResolutionCount: result.validResolutionCount,
      duplicateResolutionCount: result.duplicateResolutionCount,
      rejectedResolutionCount: result.rejectedResolutionCount,
      noPayloadCount: result.noPayloadCount,
      groupedRowsWritten: result.groupedRows.length,
      faithfulnessRowsWritten: result.faithfulnessRows.length,
      supersededGroupedCount: result.supersededGroupedCount,
      supersededFaithfulnessCount: result.supersededFaithfulnessCount,
      invalidMissingBaseGroupCount: result.invalidMissingBaseGroupCount,
      overlayRewritePerformed: true,
      outputHashes: {
        groupedOverlaySha256: stableHash(result.groupedRows),
        faithfulnessOverlaySha256: stableHash(result.faithfulnessRows),
      },
      outcomes: result.outcomes,
      resolutionsPath: DEFAULT_REVIEW_RESOLUTIONS_PATH,
      groupedOverlayPath: DEFAULT_REVIEWED_GROUPED_DATASET_PATH,
      faithfulnessOverlayPath: DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH,
    };
  const deterministicSummaryHashPayload = {
    ...summaryPayload,
    generatedAt: "__nondeterministic_timestamp_excluded__",
  };
  writeReviewPromotionSummary(
    {
      ...summaryPayload,
      outputHashes: {
        ...summaryPayload.outputHashes,
        summaryPayloadSha256: stableHash(deterministicSummaryHashPayload),
      },
    },
    DEFAULT_REVIEW_PROMOTION_SUMMARY_PATH
  );

  console.log(
    `[review-promotion] grouped=${result.groupedRows.length} faithfulness=${result.faithfulnessRows.length} duplicates_ignored=${result.duplicateResolutionCount} rejected=${result.rejectedResolutionCount} no_payload=${result.noPayloadCount} invalid_missing_base_group=${result.invalidMissingBaseGroupCount} superseded_grouped=${result.supersededGroupedCount} superseded_faithfulness=${result.supersededFaithfulnessCount}`
  );

  return {
    groupedRows: result.groupedRows.length,
    faithfulnessRows: result.faithfulnessRows.length,
    duplicateResolutionCount: result.duplicateResolutionCount,
  };
}

function main(): void {
  runReviewPromotion();
}

if (require.main === module) {
  main();
}
