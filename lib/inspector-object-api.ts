import type { PatternClaimView } from "./patterns-api";
import type {
  UserMapConclusionPublicApiDetailItem,
  WhatChangedListItem,
} from "./public-intelligence-safe-slice";
import type { RealityTrackingModelMovementReport } from "./reality-tracking-output-contract";

export const INSPECTOR_USER_MAP_DETAIL_ENDPOINT = (id: string) =>
  `/api/user-map/conclusions/${encodeURIComponent(id)}`;

export const INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT = (id: string) =>
  `/api/user-map/conclusions/${encodeURIComponent(id)}/evidence`;

export const INSPECTOR_MODEL_UPDATE_DETAIL_ENDPOINT = (id: string) =>
  `/api/what-changed/${encodeURIComponent(id)}`;

export const INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT = (id: string) =>
  `/api/what-changed/${encodeURIComponent(id)}/evidence`;

export const INSPECTOR_PATTERN_CLAIM_ENDPOINT = (id: string) =>
  `/api/inspector/pattern-claims/${encodeURIComponent(id)}`;

export const INSPECTOR_CONTRADICTION_ENDPOINT = (id: string) =>
  `/api/inspector/contradictions/${encodeURIComponent(id)}`;

export const INSPECTOR_INVESTIGATION_ENDPOINT = (id: string) =>
  `/api/inspector/investigations/${encodeURIComponent(id)}`;

export type InspectorEvidenceLinkItem = {
  /** Stable evidence-link id when available (canonical public evidence uses this). */
  id?: string;
  sourceTypeLabel: string;
  evidenceSummaryLabel: string;
  /** Verified public href only — never an empty string fake destination. */
  sourceObjectHref: string | null;
  /** Null when source timing is unknown — never fabricate acceptance time. */
  createdAt: string | null;
  hasEvidence: true;
  sourceType?: string;
  sourceId?: string;
  objectTitle?: string | null;
  linkRole?: string | null;
  /** Browser-safe provenance label for canonical ModelUpdate Inspector receipts. */
  evidenceTarget?: "direct_movement" | "resulting_revision";
  evidenceTargetLabel?: string;
  /** Browser-safe drill-down projection for canonical ModelUpdate receipt clicks. */
  canonicalEvidenceDrilldown?: CanonicalModelUpdateEvidenceDrilldownProjection;
};

export type CanonicalModelUpdateEvidenceClass =
  | "direct_movement_evidence"
  | "resulting_revision_evidence";

export type CanonicalModelUpdateEvidenceDisclosure =
  | "available"
  | "redacted"
  | "unavailable";

export type CanonicalModelUpdateEvidenceDrilldownProjection = {
  selectionId: string;
  evidenceClass: CanonicalModelUpdateEvidenceClass;
  evidenceClassLabel: string;
  sourceType: string;
  sourceTypeLabel: string;
  role: string;
  roleLabel: string;
  title: string;
  summary: string | null;
  snippet: string | null;
  /** Safe source-family / capture-surface origin label. */
  sourceOrigin: string | null;
  recordedAt: string | null;
  recordedLabel: string | null;
  provenanceLabel: string;
  sourceDisclosure: CanonicalModelUpdateEvidenceDisclosure;
  /**
   * Opaque navigation identity for returning to the originating canonical
   * ModelUpdate. Not a lineage authority field.
   */
  returnSelectionId: string;
};

import type { ContradictionDualSourcePresentation } from "./contradiction-dual-source-presentation-contract";

export type InspectorContradictionProjection = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
  /** Exact ordered Side A / Side B source projection (CEQR-009). */
  dualSource: ContradictionDualSourcePresentation;
};

export type InspectorModelUpdateDetail = {
  item: WhatChangedListItem;
  report: RealityTrackingModelMovementReport;
  canonicalInspectorProjection?: CanonicalModelUpdateInspectorProjection | null;
};

export type CanonicalModelUpdateInspectorProjection = {
  projectionType: "canonical_model_update_inspector";
  modelUpdateId: string;
  updateLabel: string;
  displayedTitle: string;
  distinctSummary: string | null;
  createdAt: string;
  rationale: string | null;
  before: string | null;
  after: string | null;
  resultingStateAtPublication: {
    title: string;
    summary: string;
    version: number;
    acceptedAt: string;
  };
  currentUnderstandingNow: {
    title: string;
    summary: string;
    version: number;
    acceptedAt: string;
  };
  directMovementEvidence: InspectorEvidenceLinkItem[];
  resultingRevisionEvidence: InspectorEvidenceLinkItem[];
  relatedObjects: Array<{
    selectionId: string;
    title: string;
    inspectorObjectType: "canonical_concept";
  }>;
};

export type InspectorInvestigationEvidenceItem = {
  linkId: string;
  evidenceId: string;
  messageId: string;
  excerpt: string;
  sessionId: string | null;
  sessionLabel: string | null;
  origin: string | null;
  role: string;
  createdAt: string;
  evidenceHref: string;
};

export type InspectorInvestigationFieldworkItem = {
  id: string;
  prompt: string;
  reason: string;
  status: string;
  statusLabel: string;
  linkedObjectType: string;
  linkedObjectId: string;
  observationNote: string | null;
  observationOutcome: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  detailHref: string | null;
};

export type InspectorInvestigationDetail = {
  id: string;
  detailHref: string | null;
  title: string;
  organizingQuestion: string;
  status: string;
  statusLabel: string;
  seedType: string;
  seedTypeLabel: string;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  reopenReason: string | null;
  resolvedConclusionId: string | null;
  resolvedConclusionHref: string | null;
  competingTheories: string[];
  evidenceNeeded: string[];
  linkedEvidence: InspectorInvestigationEvidenceItem[];
  linkedFieldwork: InspectorInvestigationFieldworkItem[];
  availableEvidence?: Array<{
    id: string;
    messageId: string;
    excerpt: string;
    sessionId: string | null;
    sessionLabel: string | null;
    origin: string | null;
    createdAt: string;
  }>;
  isClosed: boolean;
  closureStateLabel: string;
};

export async function fetchInspectorUserMapDetail(
  id: string
): Promise<UserMapConclusionPublicApiDetailItem | null> {
  const response = await fetch(INSPECTOR_USER_MAP_DETAIL_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: UserMapConclusionPublicApiDetailItem };
  return payload.item ?? null;
}

export async function fetchInspectorEvidenceLinks(
  endpoint: string
): Promise<InspectorEvidenceLinkItem[]> {
  const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { items?: InspectorEvidenceLinkItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchInspectorModelUpdateDetail(
  id: string
): Promise<InspectorModelUpdateDetail | null> {
  const response = await fetch(INSPECTOR_MODEL_UPDATE_DETAIL_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as Partial<InspectorModelUpdateDetail>;
  return payload.item && payload.report
    ? ({
        item: payload.item,
        report: payload.report,
        canonicalInspectorProjection: payload.canonicalInspectorProjection ?? null,
      } as InspectorModelUpdateDetail)
    : null;
}

export async function fetchInspectorPatternClaim(id: string): Promise<PatternClaimView | null> {
  const response = await fetch(INSPECTOR_PATTERN_CLAIM_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: PatternClaimView };
  return payload.item ?? null;
}

export async function fetchInspectorContradiction(
  id: string
): Promise<InspectorContradictionProjection | null> {
  const response = await fetch(INSPECTOR_CONTRADICTION_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: InspectorContradictionProjection };
  return payload.item ?? null;
}

export async function fetchInspectorInvestigationDetail(
  id: string
): Promise<InspectorInvestigationDetail | null> {
  const response = await fetch(INSPECTOR_INVESTIGATION_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: InspectorInvestigationDetail };
  return payload.item ?? null;
}
