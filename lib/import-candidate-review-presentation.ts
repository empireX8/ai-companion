/**
 * Maps pending import candidates into OrvekImportReviewBatch for the shell.
 * Never injects seed densograph candidates.
 */

import type {
  OrvekImportReviewBatch,
  OrvekImportReviewCandidate,
} from "./orvek-v0/data-provider";
import type { OrvekObject } from "./orvek-v0/orvek-types";
import type { PendingImportCandidatePage } from "./import-candidate-review-query";

function mapReferenceTypeToOrvekType(
  candidateType: string,
): OrvekObject["type"] {
  switch (candidateType) {
    case "pattern":
      return "map-object";
    case "goal":
    case "preference":
    case "constraint":
    case "rule":
      return "map-object";
    case "assumption":
    case "hypothesis":
      return "context";
    case "source":
      return "receipt";
    default:
      return "map-object";
  }
}

export function mapPendingImportPageToReviewBatch(
  page: PendingImportCandidatePage,
): OrvekImportReviewBatch {
  const batchId =
    page.sourceImportBatchIds[0] ??
    (page.totalPendingCount > 0
      ? "import-review-pending-batch"
      : "import-review-empty");

  const candidates: OrvekImportReviewCandidate[] = page.candidates.map(
    (c) => {
      const type: OrvekObject["type"] =
        c.sourceTable === "ContradictionNode"
          ? "map-object"
          : mapReferenceTypeToOrvekType(c.candidateType);

      const raw =
        c.evidenceExcerpt?.trim() ||
        (c.sourceTable === "ContradictionNode"
          ? c.claimOrSummary
          : c.title);

      return {
        id: c.reviewKey,
        raw,
        proposed: c.title,
        type,
        confidence: c.confidence,
        candidateSourceTable: c.sourceTable,
        candidateType: c.candidateType,
        status: c.status,
        provenance: c.provenance,
        sourceSessionId: c.sourceSessionId,
        sourceMessageId: c.sourceMessageId,
        sourceImportBatchId: c.sourceImportBatchId,
        evidenceExcerpt: c.evidenceExcerpt,
        createdAt: c.createdAt.toISOString(),
      };
    },
  );

  return {
    sourceObjectId: `import-batch:${batchId}`,
    candidates,
    totalPendingCount: page.totalPendingCount,
    sourceImportBatchIds: page.sourceImportBatchIds,
    sourceTables: page.sourceTables,
    loading: false,
    error: null,
  };
}

export function emptyImportReviewBatch(args?: {
  loading?: boolean;
  error?: string | null;
}): OrvekImportReviewBatch {
  return {
    sourceObjectId: "import-review-empty",
    candidates: [],
    totalPendingCount: 0,
    sourceImportBatchIds: [],
    sourceTables: ["ReferenceItem", "ContradictionNode"],
    loading: args?.loading ?? false,
    error: args?.error ?? null,
  };
}
