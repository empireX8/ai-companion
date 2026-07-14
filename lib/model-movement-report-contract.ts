import type { UnderstandingLinkTargetType } from "@prisma/client";

import type { OrvekObject } from "./orvek-v0/orvek-types";
import {
  assessMovementRationale,
  type MovementRationaleAssessment,
} from "./model-movement-rationale";
import {
  hasInspectableMovementDelta,
  hasRecordedBeforeAfterMovement,
  isMovementObject,
} from "./orvek-v0/production/today-movement-report-parity";

export const CANONICAL_MOVEMENT_REPORT_CONTRACT_VERSION =
  "orvek-model-movement-report-v1";

/**
 * Shared production identity for a movement report across Today, Timeline and Inspector.
 * The report id equals the published ModelUpdate id — never a zip/reference substitute.
 */
export type CanonicalMovementReportIdentity = {
  reportId: string;
  modelUpdateId: string;
};

export type CanonicalMovementStateField = {
  summary: string | null;
  recorded: boolean;
};

export type CanonicalMovementEvidenceStatus = {
  linkCount: number;
  recorded: boolean;
  missingExplicit: boolean;
};

export type CanonicalMovementReport = CanonicalMovementReportIdentity & {
  contractVersion: typeof CANONICAL_MOVEMENT_REPORT_CONTRACT_VERSION;
  affectedObject: {
    type: UnderstandingLinkTargetType;
    id: string;
    typeLabel: string;
    href: string | null;
  };
  before: CanonicalMovementStateField;
  after: CanonicalMovementStateField;
  movementSummary: string;
  rationale: CanonicalMovementStateField & {
    assessment: MovementRationaleAssessment;
  };
  evidence: CanonicalMovementEvidenceStatus;
  createdAt: string;
  reportReady: boolean;
  blockers: string[];
};

export type ModelMovementDepthRecord = {
  id: string;
  before: string | null;
  after: string | null;
  movementSummary: string;
  movementRationale: string | null;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  affectedObjectTypeLabel?: string;
  affectedObjectHref?: string | null;
  createdAt: string;
  evidenceLinkCount: number;
  /** User-visible evidence quotes cited by this update (for report overlay). */
  evidenceQuotes?: string[];
};

export type ModelMovementDepthById = Record<string, ModelMovementDepthRecord>;

export function buildModelMovementDepthIndex(
  records: ModelMovementDepthRecord[],
): ModelMovementDepthById {
  const index: ModelMovementDepthById = {};
  for (const record of records) {
    index[record.id] = record;
  }
  return index;
}

export function resolveCanonicalMovementReportFromDepth(
  record: ModelMovementDepthRecord | null | undefined,
): CanonicalMovementReport | null {
  if (!record) {
    return null;
  }

  const beforeRecorded = Boolean(record.before?.trim());
  const afterRecorded = Boolean(record.after?.trim());
  const rationaleAssessment = assessMovementRationale({
    rationale: record.movementRationale,
    movementSummary: record.movementSummary,
  });

  const blockers: string[] = [];
  if (!beforeRecorded) {
    blockers.push("missing_before_snapshot");
  }
  if (!afterRecorded) {
    blockers.push("missing_after_snapshot");
  }
  if (!rationaleAssessment.recorded) {
    blockers.push(...rationaleAssessment.blockers);
  }
  if (record.evidenceLinkCount <= 0) {
    blockers.push("missing_evidence_links");
  }

  const reportReady =
    beforeRecorded &&
    afterRecorded &&
    Boolean(record.movementSummary.trim()) &&
    record.evidenceLinkCount > 0 &&
    rationaleAssessment.recorded;

  return {
    contractVersion: CANONICAL_MOVEMENT_REPORT_CONTRACT_VERSION,
    reportId: record.id,
    modelUpdateId: record.id,
    affectedObject: {
      type: record.affectedObjectType,
      id: record.affectedObjectId,
      typeLabel: record.affectedObjectTypeLabel ?? record.affectedObjectType,
      href: record.affectedObjectHref ?? null,
    },
    before: {
      summary: record.before,
      recorded: beforeRecorded,
    },
    after: {
      summary: record.after,
      recorded: afterRecorded,
    },
    movementSummary: record.movementSummary,
    rationale: {
      summary: record.movementRationale,
      recorded: rationaleAssessment.recorded,
      assessment: rationaleAssessment,
    },
    evidence: {
      linkCount: record.evidenceLinkCount,
      recorded: record.evidenceLinkCount > 0,
      missingExplicit: record.evidenceLinkCount <= 0,
    },
    createdAt: record.createdAt,
    reportReady,
    blockers,
  };
}

export function enrichOrvekObjectWithMovementDepth(
  object: OrvekObject,
  depth: ModelMovementDepthRecord | null | undefined,
): OrvekObject {
  if (!depth) {
    return object;
  }

  const canonical = resolveCanonicalMovementReportFromDepth(depth);
  const enriched: OrvekObject = {
    ...object,
    before: depth.before?.trim() ? depth.before : undefined,
    after: depth.after?.trim() ? depth.after : undefined,
    reportSummary: depth.movementSummary,
    reportType: "What Changed",
    reportProvenance: canonical?.reportReady ? "live_model_update" : object.reportProvenance,
    movementRationale: depth.movementRationale ?? undefined,
    canonicalReportId: depth.id,
    evidenceCount: depth.evidenceLinkCount,
    evidenceQuotes: depth.evidenceQuotes?.filter((quote) => quote.trim()) ?? [],
  };

  if (canonical?.reportReady) {
    enriched.summary = depth.movementSummary;
  }

  return enriched;
}

export function buildMovementReportOrvekObject(
  depth: ModelMovementDepthRecord,
): OrvekObject | null {
  const canonical = resolveCanonicalMovementReportFromDepth(depth);
  if (!canonical?.reportReady) {
    return null;
  }

  return {
    id: depth.id,
    type: "model-update",
    title: depth.movementSummary,
    summary: `${depth.affectedObjectTypeLabel ?? depth.affectedObjectType} movement`,
    reportSummary: depth.movementSummary,
    reportType: "What Changed",
    reportProvenance: "live_model_update",
    before: depth.before ?? undefined,
    after: depth.after ?? undefined,
    movementRationale: depth.movementRationale ?? undefined,
    canonicalReportId: depth.id,
    eventType: "Model update",
    tags: ["Model update", "What Changed report"],
    inspectorObjectType: "model_update",
    inspectorObjectId: depth.id,
    lastUpdated: new Date(depth.createdAt).toISOString(),
    evidenceCount: depth.evidenceLinkCount,
    evidenceQuotes: depth.evidenceQuotes?.filter((quote) => quote.trim()) ?? [],
    receiptIds: (depth.evidenceQuotes ?? []).map(
      (_, index) => `${depth.id}::cited-evidence::${index}`,
    ),
  };
}

/** Synthetic receipt objects for live report overlay evidence citations. */
export function buildMovementReportCitedEvidenceObjects(
  depth: ModelMovementDepthRecord,
): OrvekObject[] {
  const objects: OrvekObject[] = [];

  for (const [index, quote] of (depth.evidenceQuotes ?? []).entries()) {
    const trimmed = quote.trim();
    if (!trimmed) {
      continue;
    }
    objects.push({
      id: `${depth.id}::cited-evidence::${index}`,
      type: "receipt",
      title: trimmed,
      sourceText: trimmed,
      tags: ["Cited evidence"],
    });
  }

  return objects;
}

export function isCanonicalMovementReportObject(
  object: OrvekObject | undefined,
): boolean {
  if (!object) {
    return false;
  }

  return Boolean(object.canonicalReportId && hasRecordedBeforeAfterMovement(object));
}

export function resolveSelectedMovementReportId(
  object: OrvekObject | undefined,
): string | null {
  if (!object) {
    return null;
  }

  if (object.canonicalReportId?.trim()) {
    return object.canonicalReportId.trim();
  }

  if (isMovementObject(object) && hasInspectableMovementDelta(object)) {
    return object.id;
  }

  return null;
}

export function mustNotUseReferenceReportForCanonicalId(
  reportId: string | null | undefined,
  referenceReportIds: string[],
): boolean {
  if (!reportId) {
    return true;
  }

  return !referenceReportIds.includes(reportId);
}

/**
 * Movement depth fields owned by enrichment — must survive attention-object registration.
 */
export function isDepthEnrichedMovementObject(
  object: OrvekObject | undefined,
): boolean {
  if (!object || object.type !== "model-update") {
    return false;
  }

  return Boolean(
    object.canonicalReportId?.trim() ||
      object.before?.trim() ||
      object.after?.trim() ||
      object.movementRationale?.trim() ||
      object.reportSummary?.trim(),
  );
}

/**
 * Merge a selectable shell onto a depth-enriched ModelUpdate without clobbering snapshots.
 */
export function mergeOrvekObjectPreservingMovementDepth(
  existing: OrvekObject | undefined,
  shell: OrvekObject,
): OrvekObject {
  if (!existing || !isDepthEnrichedMovementObject(existing)) {
    return shell;
  }

  return {
    ...shell,
    type: "model-update",
    before: existing.before,
    after: existing.after,
    movementRationale: existing.movementRationale,
    canonicalReportId: existing.canonicalReportId,
    reportSummary: existing.reportSummary ?? shell.reportSummary,
    reportType: existing.reportType ?? shell.reportType,
    reportProvenance: existing.reportProvenance ?? shell.reportProvenance,
    evidenceCount: existing.evidenceCount ?? shell.evidenceCount,
    evidenceQuotes: existing.evidenceQuotes ?? shell.evidenceQuotes,
    receiptIds: existing.receiptIds ?? shell.receiptIds,
    summary:
      existing.reportSummary?.trim() && existing.canonicalReportId
        ? (existing.summary ?? shell.summary)
        : (shell.summary ?? existing.summary),
    inspectorObjectType: shell.inspectorObjectType ?? existing.inspectorObjectType,
    inspectorObjectId: shell.inspectorObjectId ?? existing.inspectorObjectId,
    eventType: shell.eventType ?? existing.eventType,
    tags: shell.tags ?? existing.tags,
    lastUpdated: existing.lastUpdated ?? shell.lastUpdated,
  };
}
