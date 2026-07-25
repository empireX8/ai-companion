/**
 * Canonical Today Composition contract — explicit production output for Today layout.
 * Consumed by Today/hybrid API → live provider. Not inferred in presentation.
 */

import type { OrvekObject } from "./orvek-v0/orvek-types";

export const CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION =
  "canonical-today-composition-v1" as const;

export type CanonicalTodayNowRowPayload = {
  id: string;
  kicker: string;
  title: string;
  status: string;
  /** Production object id to select / navigate */
  destinationId: string;
  destinationType?: string;
};

export type CanonicalTodayMovementEntryPayload = {
  id: string;
  previous: string;
  updated: string;
  explanation: string;
  receiptIds: string[];
  receiptCount: number;
  actionLabel: string;
  destinationId: string;
  destinationType: "model_update" | "report" | "object";
  rank: number;
  affectedObjectId?: string;
  affectedObjectType?: string;
  timestamp?: string;
};

export type CanonicalTodayPrimaryActionPayload = {
  label: string;
  primary?: boolean;
  destinationId?: string;
  destinationType?: string;
  reportId?: string;
};

/** Page-rail layouts for full workbench round-trip (Map / Timeline / Decisions / Explore). */
export type CanonicalWorkbenchLayoutPayload = {
  mapCategories: Array<{ id: string; label: string; ids: string[] }>;
  mapDefaultSelectedId: string;
  timelineGroups: Array<{ heading: string; ids: string[] }>;
  timelineFilters: string[];
  decisionListGroups: Array<{
    heading: string;
    ids: string[];
    tone?: "action";
  }>;
  decisionsDefaultId: string;
  exploreGroundingIds: string[];
  exploreMovement: Array<{
    id: string;
    kind: string;
    text: string;
    linkId?: string;
  }>;
  exploreQuestionIds: string[];
  exploreInvestigationIds: string[];
  exploreFieldworkIds: string[];
  exploreLiveDetectionCopy?: string;
  /**
   * Global Map/model summary measures (not a densograph row count).
   * Reference authority: Confidence + receipt total + open-question total.
   */
  mapHeader?: {
    confidenceLabel: string;
    receiptsLabel: string;
    openQuestionsLabel: string;
  };
  /**
   * Review-import overlay batch (production IDs).
   * Enables TopBar Import when present on the live/hybrid API.
   */
  importReview?: {
    sourceObjectId: string;
    candidates: Array<{
      id: string;
      raw: string;
      proposed: string;
      type: OrvekObject["type"];
      confidence: "high" | "medium" | "low";
    }>;
  };
  /**
   * TopBar living model-status card (movement / questions / reviews).
   * Reference authority for full-reference round-trip; absent on Today-only seeds.
   */
  modelStatusCard?: {
    movementPlaceCount: number;
    openQuestionCount: number;
    openReviewCount: number;
    title?: string;
    meta?: string;
    compactLabel?: string;
    destination:
      | { kind: "workbench-page"; page: "map" }
      | { kind: "route"; href: string };
  };
};

export type CanonicalTodayCompositionPayload = {
  contractVersion: typeof CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION;
  briefingLine: string;
  briefingTitle: string;
  briefingMeta: string;
  leadObjectId: string;
  leadObjectType: string;
  leadTitle: string;
  leadNarrative: string;
  leadWhatChanged: string;
  leadLastEvidence: string;
  leadKicker: string;
  nowRows: CanonicalTodayNowRowPayload[];
  resurfacedObjectIds: string[];
  movements: CanonicalTodayMovementEntryPayload[];
  reportId: string;
  primaryActions: CanonicalTodayPrimaryActionPayload[];
  /**
   * Optional densograph projections registered into getObject for Inspector.
   * Production IDs only — never fixture ids.
   */
  objects?: OrvekObject[];
  /** Fixture id → production id (seed/debug only; not required for render). */
  fixtureIdMap?: Record<string, string>;
  /**
   * Full-app page rails. When present, hybrid prefers these over sparse live surfaces.
   * Absent on Today-only seeds (backward compatible).
   */
  workbench?: CanonicalWorkbenchLayoutPayload;
};

export function isCanonicalTodayCompositionPayload(
  value: unknown,
): value is CanonicalTodayCompositionPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.contractVersion === CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION &&
    typeof v.briefingTitle === "string" &&
    typeof v.leadObjectId === "string" &&
    Array.isArray(v.nowRows) &&
    Array.isArray(v.movements) &&
    typeof v.reportId === "string"
  );
}

export type CanonicalModelMovementReportSection = {
  id: string;
  heading: string;
  body: string;
};

export type CanonicalModelMovementReportRecord = {
  id: string;
  userId: string;
  reportType: string;
  title: string;
  status: string;
  meta: string;
  period: string | null;
  sections: CanonicalModelMovementReportSection[];
  relatedMovementIds: string[];
  relatedReceiptIds: string[];
  generatedAt: string;
};

export function reportRecordToOrvekObject(
  report: CanonicalModelMovementReportRecord,
): OrvekObject {
  return {
    id: report.id,
    type: "report",
    title: report.title,
    reportType: report.reportType,
    period: report.period ?? undefined,
    reportSummary: report.meta,
    summary: report.sections.map((s) => s.body).filter(Boolean).join("\n\n") || report.meta,
    receiptIds: report.relatedReceiptIds,
    relatedIds: report.relatedMovementIds,
    tags: ["Report", report.reportType],
    evidenceCount: report.relatedReceiptIds.length,
    lastUpdated: report.generatedAt,
    canonicalReportId: report.id,
    // Marks composition/report densographs so production hybrid can refuse
    // reference authority without mistaking live ModelUpdate reports.
    reportProvenance: "reference_sample",
    canonicalSourceType: "CanonicalModelMovementReport",
  };
}
