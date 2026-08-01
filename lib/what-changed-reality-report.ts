import "server-only";

import { createHash } from "node:crypto";

import {
  ContradictionStatus,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  ModelUpdateVisibility,
  PatternClaimStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
  type UnderstandingLinkRole,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import prismadb from "./prismadb";
import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import { deriveExploreMovementModelUpdateId } from "./explore-movement-proposal-provenance";
import {
  findCanonicalProposalsByDeterministicModelUpdateId,
  requireSingleDeterministicCanonicalProposal,
} from "./canonical-what-changed-identity";

import {
  REALITY_TRACKING_OUTPUT_CONTRACT_VERSION,
  REALITY_TRACKING_OUTPUT_PROMPT_VERSION,
  type RealityTrackingClaim,
  type RealityTrackingClaimClassification,
  type RealityTrackingClaimSection,
  type RealityTrackingEvidenceRef,
  type RealityTrackingEvidenceStatus,
  type RealityTrackingModelMovementReport,
} from "./reality-tracking-output-contract";
import { decodeMovementRationaleFromInternalNotes } from "./model-movement-rationale";
import {
  buildPublicObjectHref,
  formatPublicEvidenceSourceTypeLabel,
} from "./public-continuity-registry";
import { applyVerifiedAffectedObjectHrefs } from "./public-linked-object-continuity";
import {
  formatFieldworkStatus,
  formatInvestigationStatus,
  formatLinkedObjectType,
  formatModelUpdateType,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "./watch-for";
import {
  firstMeaningfulModelUpdateText,
  resolveModelUpdateDisplayTitle,
} from "./model-update-identity";
import type {
  CanonicalModelUpdateEvidenceDisclosure,
  CanonicalModelUpdateEvidenceDrilldownProjection,
  CanonicalModelUpdateInspectorProjection,
  InspectorEvidenceLinkItem,
  InspectorModelUpdateDetail,
} from "./inspector-object-api";
import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";

type ModelUpdateDetailRow = {
  id: string;
  updateType: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  createdAt: Date;
  beforeSummary: string | null;
  afterSummary: string | null;
  confidenceDelta: number | null;
  internalNotes: string | null;
  canonicalConceptId?: string | null;
  previousRevisionId?: string | null;
  resultingRevisionId?: string | null;
  exploreProposalId?: string | null;
};

type UnderstandingEvidenceLinkRow = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary: string | null;
  snippet: string | null;
  quote: string | null;
  weight: number | null;
  confidenceContribution: number | null;
  createdAt: Date;
};

type PatternClaimSourceRow = {
  id: string;
  summary: string;
  status: PatternClaimStatus;
};

type ContradictionSourceRow = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: ContradictionStatus;
};

type SurfacedActionSourceRow = {
  id: string;
  bucket: string;
  status: string;
  note: string | null;
  updatedAt: Date;
};

type JournalEntrySourceRow = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
};

type MessageSourceRow = {
  id: string;
  content: string;
  createdAt: Date;
  sessionId: string;
};

type QuickCheckInSourceRow = {
  id: string;
  stateTag: string | null;
  eventTags: string[];
  note: string | null;
  createdAt: Date;
};

type SessionSourceRow = {
  id: string;
  label: string | null;
  surfaceType: string | null;
  startedAt: Date;
};

type UserMapAffectedObjectRow = {
  id: string;
  title: string;
  summary: string;
  status: string;
  confidenceLevel: string;
  evidenceCount: number;
  sourceDiversity: number;
  timeSpreadDays: number;
  lastUserCorrectionAt: Date | null;
  lastUserCorrectionLabel: string | null;
  updatedAt: Date;
};

type InvestigationAffectedObjectRow = {
  id: string;
  title: string;
  organizingQuestion: string;
  status: string;
  priority: number | null;
  resolutionSummary: string | null;
  updatedAt: Date;
};

type FieldworkAffectedObjectRow = {
  id: string;
  prompt: string;
  reason: string;
  status: string;
  observationOutcome: string | null;
  observationNote: string | null;
  updatedAt: Date;
};

type PatternAffectedObjectRow = {
  id: string;
  summary: string;
  status: string;
  strengthLevel: string;
};

type ContradictionAffectedObjectRow = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
  lastTouchedAt: Date;
};

type FieldworkRelatedRow = {
  id: string;
  prompt: string;
  reason: string;
  status: string;
  updatedAt: Date;
};

type RecentMovementRow = {
  id: string;
  updateType: string;
  userFacingSummary: string;
  createdAt: Date;
};

type ModelMovementAffectedObject =
  | {
      type: "usermap_conclusion";
      title: string;
      summary: string;
      statusLabel: string;
      confidenceLabel: string;
      evidenceCount: number;
      sourceDiversity: number;
      timeSpreadDays: number;
      correctionLabel: string | null;
      detailHref: string | null;
    }
  | {
      type: "investigation";
      title: string;
      summary: string;
      statusLabel: string;
      detailHref: string | null;
    }
  | {
      type: "fieldwork_assignment";
      title: string;
      summary: string;
      statusLabel: string;
      detailHref: string | null;
    }
  | {
      type: "pattern_claim";
      title: string;
      summary: string;
      statusLabel: string;
      detailHref: string | null;
    }
  | {
      type: "contradiction_node";
      title: string;
      summary: string;
      statusLabel: string;
      detailHref: string | null;
    }
  | null;

export type ModelMovementRealityPacketEvidence = {
  id: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  createdAt: string;
  sourceTypeLabel: string;
  displayLabel: string;
  href: string | null;
  analysisText: string | null;
  safeSummary?: string | null;
  safeSnippet?: string | null;
  sourceDisclosure?: CanonicalModelUpdateEvidenceDisclosure;
};

type ModelMovementRelatedFieldwork = {
  id: string;
  prompt: string;
  reason: string;
  statusLabel: string;
  updatedAt: string;
};

type ModelMovementRelatedAction = {
  id: string;
  label: string;
  statusLabel: string;
  updatedAt: string;
};

type ModelMovementRecentMovement = {
  id: string;
  updateTypeLabel: string;
  userFacingSummary: string;
  createdAt: string;
};

export type ModelMovementRealityPacket = {
  item: WhatChangedListItem;
  modelUpdate: {
    id: string;
    updateTypeLabel: string;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectTypeLabel: string;
    userFacingSummary: string;
    createdAt: string;
    before: string | null;
    after: string | null;
    confidenceShift: number | null;
    movementRationale: string | null;
  };
  affectedObject: ModelMovementAffectedObject;
  evidence: ModelMovementRealityPacketEvidence[];
  relatedFieldwork: ModelMovementRelatedFieldwork[];
  relatedActions: ModelMovementRelatedAction[];
  recentMovements: ModelMovementRecentMovement[];
};

type WhatChangedRealityReportDb = {
  modelUpdate: {
    findFirst: (args: unknown) => Promise<ModelUpdateDetailRow | null>;
    findMany: (args: unknown) => Promise<RecentMovementRow[]>;
  };
  exploreMovementProposal?: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      userId: string;
      status: ExploreMovementProposalStatus;
      authorityMode: ExploreMovementAuthorityMode;
      modelUpdateId: string | null;
      canonicalConceptId: string | null;
    } | null>;
  };
  understandingEvidenceLink: {
    findMany: (args: unknown) => Promise<UnderstandingEvidenceLinkRow[]>;
  };
  userMapConclusion: {
    findFirst: (args: unknown) => Promise<UserMapAffectedObjectRow | null>;
  };
  investigation: {
    findFirst: (args: unknown) => Promise<InvestigationAffectedObjectRow | null>;
  };
  fieldworkAssignment: {
    findFirst: (args: unknown) => Promise<FieldworkAffectedObjectRow | null>;
    findMany: (args: unknown) => Promise<FieldworkRelatedRow[]>;
  };
  patternClaim: {
    findFirst: (args: unknown) => Promise<PatternAffectedObjectRow | null>;
    findMany: (args: unknown) => Promise<PatternClaimSourceRow[]>;
  };
  contradictionNode: {
    findFirst: (args: unknown) => Promise<ContradictionAffectedObjectRow | null>;
    findMany: (args: unknown) => Promise<ContradictionSourceRow[]>;
  };
  surfacedAction: {
    findMany: (args: unknown) => Promise<SurfacedActionSourceRow[]>;
  };
  journalEntry: {
    findMany: (args: unknown) => Promise<JournalEntrySourceRow[]>;
  };
  message: {
    findMany: (args: unknown) => Promise<MessageSourceRow[]>;
  };
  quickCheckIn: {
    findMany: (args: unknown) => Promise<QuickCheckInSourceRow[]>;
  };
  session: {
    findMany: (args: unknown) => Promise<SessionSourceRow[]>;
  };
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength = 120): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const bounded = normalized.slice(0, maxLength);
  const lastSpace = bounded.lastIndexOf(" ");
  return `${(lastSpace > 0 ? bounded.slice(0, lastSpace) : bounded).trimEnd()}…`;
}

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatDateRangeLabel(values: string[]): string | null {
  const valid = values
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (valid.length === 0) {
    return null;
  }

  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  if (first.toISOString() === last.toISOString()) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(first);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return `${formatter.format(first)} → ${formatter.format(last)}`;
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const next: T[] = [];

  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(item);
  }

  return next;
}

const MOVEMENT_EVIDENCE_LINK_LIMIT = 12;

function mergeMovementEvidenceLinkRows(
  movementRows: UnderstandingEvidenceLinkRow[],
  affectedObjectRows: UnderstandingEvidenceLinkRow[]
): UnderstandingEvidenceLinkRow[] {
  return uniqueBy([...movementRows, ...affectedObjectRows], (row) => row.id)
    .sort((left, right) => {
      const byTime = right.createdAt.getTime() - left.createdAt.getTime();
      if (byTime !== 0) {
        return byTime;
      }
      return right.id.localeCompare(left.id);
    })
    .slice(0, MOVEMENT_EVIDENCE_LINK_LIMIT);
}

function buildEvidenceStatus(
  refs: RealityTrackingEvidenceRef[],
  classification: RealityTrackingClaimClassification
): RealityTrackingEvidenceStatus {
  if (refs.length === 0) {
    return "UNVERIFIED";
  }

  if (classification === "fact" || classification === "supported_claim") {
    return "VERIFIED";
  }

  return "INFERRED";
}

function toEvidenceRefs(
  evidence: ModelMovementRealityPacketEvidence[]
): RealityTrackingEvidenceRef[] {
  return evidence.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceTypeLabel: item.sourceTypeLabel,
    sourceId: item.sourceId,
    role: item.role,
    label: item.displayLabel,
    href: item.href,
    createdAt: item.createdAt,
  }));
}

function makeClaim(args: {
  text: string;
  classification: RealityTrackingClaimClassification;
  evidence: ModelMovementRealityPacketEvidence[];
}): RealityTrackingClaim {
  const refs = toEvidenceRefs(uniqueBy(args.evidence, (item) => item.id).slice(0, 4));
  return {
    text: normalizeWhitespace(args.text),
    classification: args.classification,
    evidenceStatus: buildEvidenceStatus(refs, args.classification),
    evidenceRefs: refs,
  };
}

function pushUniqueClaim(list: RealityTrackingClaim[], claim: RealityTrackingClaim) {
  if (!list.some((item) => item.text === claim.text)) {
    list.push(claim);
  }
}

function pushRealityGateClaim(
  list: RealityTrackingClaim[],
  text: string,
  evidence: ModelMovementRealityPacketEvidence[]
) {
  pushUniqueClaim(
    list,
    makeClaim({
      text: `${REALITY_GATE_PENDING_EVIDENCE_LABEL} — ${normalizeWhitespace(text)}`,
      classification: "reality_gate",
      evidence,
    })
  );
}

function detectIdentityClaimText(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  if (!IDENTITY_CLAIM_PREFIX_REGEX.test(normalized)) {
    return false;
  }

  return !IDENTITY_CLAIM_TRANSIENT_REGEX.test(normalized);
}

function collectIdentityClaimText(packet: ModelMovementRealityPacket): string[] {
  return [
    packet.item.userFacingSummary,
    packet.modelUpdate.userFacingSummary,
    packet.affectedObject?.title ?? null,
    packet.affectedObject?.summary ?? null,
    packet.modelUpdate.before,
    packet.modelUpdate.after,
    ...packet.evidence.map((item) => item.analysisText),
  ].filter((value): value is string => Boolean(value));
}

function hasIdentityClaim(packet: ModelMovementRealityPacket): boolean {
  return collectIdentityClaimText(packet).some(detectIdentityClaimText);
}

function sourceTypeLabel(sourceType: UnderstandingLinkSourceType): string {
  if (sourceType === "pattern_claim" || sourceType === "contradiction_node") {
    return formatPublicEvidenceSourceTypeLabel(sourceType);
  }

  switch (sourceType) {
    case "pattern_claim_evidence":
      return "Pattern receipt";
    case "contradiction_evidence":
      return "Signal receipt";
    case "surfaced_action":
      return "Decision / action outcome";
    case "quick_check_in":
      return "Quick check-in";
    case "journal_entry":
      return "Journal entry";
    case "message":
      return "Conversation message";
    case "session":
      return "Conversation session";
    case "reference_item":
      return "Reference item";
    case "profile_artifact":
      return "Profile artifact";
    case "evidence_span":
      return "Evidence span";
    case "timeline_aggregation":
      return "Timeline context";
    case "import_record":
      return "Imported record";
    case "user_correction":
      return "User correction";
    default:
      return "Linked receipt";
  }
}

function buildSourceHref(
  sourceType: UnderstandingLinkSourceType,
  sourceId: string,
  visiblePatternIds: Set<string>,
  visibleContradictionIds: Set<string>
): string | null {
  if (sourceType === "pattern_claim" && visiblePatternIds.has(sourceId)) {
    return buildPublicObjectHref({ type: "pattern_claim", id: sourceId });
  }

  if (sourceType === "contradiction_node" && visibleContradictionIds.has(sourceId)) {
    return buildPublicObjectHref({ type: "contradiction_node", id: sourceId });
  }

  return null;
}

function coalesceAnalysisText(link: UnderstandingEvidenceLinkRow): string | null {
  const raw = link.quote ?? link.snippet ?? link.summary ?? null;
  if (!raw) {
    return null;
  }
  return normalizeWhitespace(raw);
}

function buildDisplayLabel(args: {
  link: UnderstandingEvidenceLinkRow;
  patternById: Map<string, PatternClaimSourceRow>;
  contradictionById: Map<string, ContradictionSourceRow>;
  actionById: Map<string, SurfacedActionSourceRow>;
  journalById: Map<string, JournalEntrySourceRow>;
  messageById: Map<string, MessageSourceRow>;
  quickCheckInById: Map<string, QuickCheckInSourceRow>;
  sessionById: Map<string, SessionSourceRow>;
}): string {
  const pattern = args.patternById.get(args.link.sourceId);
  if (pattern) {
    return truncateText(pattern.summary, 110);
  }

  const contradiction = args.contradictionById.get(args.link.sourceId);
  if (contradiction) {
    return truncateText(contradiction.title, 110);
  }

  const action = args.actionById.get(args.link.sourceId);
  if (action) {
    const parts = [
      "Action outcome",
      toTitleCase(action.bucket),
      toTitleCase(action.status),
    ];
    if (action.note) {
      parts.push(truncateText(action.note, 60));
    }
    return parts.join(" · ");
  }

  const journal = args.journalById.get(args.link.sourceId);
  if (journal) {
    return journal.title
      ? `Journal entry · ${truncateText(journal.title, 80)}`
      : "Journal entry";
  }

  const message = args.messageById.get(args.link.sourceId);
  if (message) {
    return "Conversation message";
  }

  const quickCheckIn = args.quickCheckInById.get(args.link.sourceId);
  if (quickCheckIn) {
    return quickCheckIn.stateTag
      ? `Quick check-in · ${toTitleCase(quickCheckIn.stateTag)}`
      : "Quick check-in";
  }

  const session = args.sessionById.get(args.link.sourceId);
  if (session) {
    if (session.label) {
      return `Conversation session · ${truncateText(session.label, 80)}`;
    }
    return session.surfaceType
      ? `Conversation session · ${toTitleCase(session.surfaceType)}`
      : "Conversation session";
  }

  if (args.link.summary) {
    return truncateText(args.link.summary, 110);
  }

  return sourceTypeLabel(args.link.sourceType);
}

function buildAnalysisText(args: {
  link: UnderstandingEvidenceLinkRow;
  patternById: Map<string, PatternClaimSourceRow>;
  contradictionById: Map<string, ContradictionSourceRow>;
  actionById: Map<string, SurfacedActionSourceRow>;
  journalById: Map<string, JournalEntrySourceRow>;
  messageById: Map<string, MessageSourceRow>;
  quickCheckInById: Map<string, QuickCheckInSourceRow>;
  sessionById: Map<string, SessionSourceRow>;
}): string | null {
  const direct = coalesceAnalysisText(args.link);
  if (direct) {
    return direct;
  }

  const pattern = args.patternById.get(args.link.sourceId);
  if (pattern) {
    return pattern.summary;
  }

  const contradiction = args.contradictionById.get(args.link.sourceId);
  if (contradiction) {
    return `${contradiction.sideA} / ${contradiction.sideB}`;
  }

  const action = args.actionById.get(args.link.sourceId);
  if (action?.note) {
    return action.note;
  }

  const journal = args.journalById.get(args.link.sourceId);
  if (journal) {
    return journal.title ? `${journal.title} ${journal.body}` : journal.body;
  }

  const message = args.messageById.get(args.link.sourceId);
  if (message) {
    return message.content;
  }

  const quickCheckIn = args.quickCheckInById.get(args.link.sourceId);
  if (quickCheckIn) {
    const parts = [
      quickCheckIn.stateTag ? toTitleCase(quickCheckIn.stateTag) : null,
      quickCheckIn.note,
      quickCheckIn.eventTags.length > 0 ? quickCheckIn.eventTags.join(" ") : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(" ") : null;
  }

  const session = args.sessionById.get(args.link.sourceId);
  if (session?.label) {
    return session.label;
  }

  return null;
}

function normalizedLabel(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "").toLowerCase();
}

function safeCanonicalEvidenceText(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value ?? "");
  return normalized ? normalized : null;
}

function formatInspectorRecordedLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function roleLabel(role: UnderstandingLinkRole): string {
  switch (role) {
    case "supports":
      return "Supporting";
    case "contradicts":
      return "Conflicting";
    case "context":
      return "Context";
    default:
      return toTitleCase(role);
  }
}

type ResolvedEvidenceSourceIds = ReadonlyMap<
  UnderstandingLinkSourceType,
  ReadonlySet<string>
>;

/**
 * A populated link summary, snippet, quote, sourceType or sourceId is not proof
 * that the underlying source row exists and belongs to the authenticated user.
 * Eligibility requires the declared source to have been returned by the existing
 * user-scoped query for its source type. Source types with no user-scoped
 * resolution query cannot be verified here and therefore fail closed.
 */
function canonicalEvidenceSourceIsEligible(args: {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  resolvedSourceIds: ResolvedEvidenceSourceIds;
}): boolean {
  const resolved = args.resolvedSourceIds.get(args.sourceType);
  if (!resolved) {
    return false;
  }
  return resolved.has(args.sourceId);
}

function canonicalEvidenceSelectionId(args: {
  modelUpdateId: string;
  evidenceClass: "direct_movement_evidence" | "resulting_revision_evidence";
  relationshipId: string;
}): string {
  const digest = createHash("sha256")
    .update("orvek:canonical-evidence-drilldown:v1")
    .update("\0")
    .update(args.modelUpdateId)
    .update("\0")
    .update(args.evidenceClass)
    .update("\0")
    .update(args.relationshipId)
    .digest("hex");

  return `canonical-evidence-${digest}`;
}

function canonicalEvidenceTitleCandidate(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeWhitespace(value);
  if (
    !normalized ||
    normalizedLabel(normalized) === "context" ||
    normalizedLabel(normalized) === "receipt"
  ) {
    return null;
  }
  return normalized;
}

function canonicalEvidenceTitle(args: {
  evidenceClassLabel: string;
  sourceTypeLabel: string;
  sourceTitle: string | null;
  summary: string | null;
  recordedLabel: string | null;
}): string {
  const sourceTitle = canonicalEvidenceTitleCandidate(args.sourceTitle);
  const summary = canonicalEvidenceTitleCandidate(args.summary);
  return (
    firstMeaningfulModelUpdateText([
      sourceTitle && normalizedLabel(sourceTitle) !== normalizedLabel(args.sourceTypeLabel)
        ? sourceTitle
        : null,
      summary,
      args.recordedLabel ? `${args.sourceTypeLabel} · ${args.recordedLabel}` : null,
      `${args.evidenceClassLabel} · ${args.sourceTypeLabel}`,
    ]) ?? `${args.evidenceClassLabel} · ${args.sourceTypeLabel}`
  );
}

function buildDirectMovementEvidenceDrilldown(args: {
  modelUpdateId: string;
  item: ModelMovementRealityPacketEvidence;
}): CanonicalModelUpdateEvidenceDrilldownProjection {
  const evidenceClass = "direct_movement_evidence" as const;
  const evidenceClassLabel = "Movement evidence";
  const recordedLabel = formatInspectorRecordedLabel(args.item.createdAt);
  const sourceDisclosure = args.item.sourceDisclosure ?? "unavailable";
  const summary = sourceDisclosure === "available" ? args.item.safeSummary ?? null : null;
  const snippet = sourceDisclosure === "available" ? args.item.safeSnippet ?? null : null;

  return {
    selectionId: canonicalEvidenceSelectionId({
      modelUpdateId: args.modelUpdateId,
      evidenceClass,
      relationshipId: args.item.id,
    }),
    evidenceClass,
    evidenceClassLabel,
    sourceType: args.item.sourceType,
    sourceTypeLabel: args.item.sourceTypeLabel,
    role: args.item.role,
    roleLabel: roleLabel(args.item.role),
    title: canonicalEvidenceTitle({
      evidenceClassLabel,
      sourceTypeLabel: args.item.sourceTypeLabel,
      sourceTitle: null,
      summary,
      recordedLabel,
    }),
    summary,
    snippet,
    recordedAt: args.item.createdAt,
    recordedLabel,
    provenanceLabel: evidenceClassLabel,
    sourceDisclosure,
  };
}

function buildResultingRevisionEvidenceDrilldown(args: {
  modelUpdateId: string;
  item: CanonicalProductConceptV1["evidence"][number];
}): CanonicalModelUpdateEvidenceDrilldownProjection {
  const evidenceClass = "resulting_revision_evidence" as const;
  const evidenceClassLabel = "Resulting revision evidence";
  const sourceTypeLabelValue = sourceTypeLabel(args.item.sourceType);
  const sourceDisclosure: CanonicalModelUpdateEvidenceDisclosure =
    args.item.disclosure === "public" ? "available" : "redacted";
  const summary =
    sourceDisclosure === "available"
      ? safeCanonicalEvidenceText(args.item.summary)
      : null;
  const snippet =
    sourceDisclosure === "available"
      ? safeCanonicalEvidenceText(args.item.snippet)
      : null;

  return {
    selectionId: canonicalEvidenceSelectionId({
      modelUpdateId: args.modelUpdateId,
      evidenceClass,
      relationshipId: args.item.id,
    }),
    evidenceClass,
    evidenceClassLabel,
    sourceType: args.item.sourceType,
    sourceTypeLabel: sourceTypeLabelValue,
    role: args.item.role,
    roleLabel: roleLabel(args.item.role),
    title: canonicalEvidenceTitle({
      evidenceClassLabel,
      sourceTypeLabel: sourceTypeLabelValue,
      sourceTitle: null,
      summary,
      recordedLabel: null,
    }),
    summary,
    snippet,
    recordedAt: null,
    recordedLabel: null,
    provenanceLabel: evidenceClassLabel,
    sourceDisclosure,
  };
}

/**
 * Keyed by evidence relationship id so the report projector and the Inspector
 * projection share one verified set. Relationships whose source did not resolve
 * as eligible are omitted and therefore have no valid drill-down projection.
 */
function buildDirectMovementEvidenceDrilldownIndex(args: {
  modelUpdateId: string;
  directEvidence: ModelMovementRealityPacketEvidence[];
  eligibleRelationshipIds: ReadonlySet<string>;
}): Map<string, CanonicalModelUpdateEvidenceDrilldownProjection> {
  const index = new Map<
    string,
    CanonicalModelUpdateEvidenceDrilldownProjection
  >();

  for (const item of args.directEvidence) {
    if (!args.eligibleRelationshipIds.has(item.id)) {
      continue;
    }
    index.set(
      item.id,
      buildDirectMovementEvidenceDrilldown({
        modelUpdateId: args.modelUpdateId,
        item,
      }),
    );
  }

  return index;
}

function movementEvidenceToInspectorItem(
  drilldown: CanonicalModelUpdateEvidenceDrilldownProjection,
): InspectorEvidenceLinkItem {
  return {
    id: drilldown.selectionId,
    sourceTypeLabel: drilldown.sourceTypeLabel,
    evidenceSummaryLabel: drilldown.summary ?? drilldown.title,
    sourceObjectHref: null,
    createdAt: drilldown.recordedAt,
    hasEvidence: true,
    sourceType: drilldown.sourceType,
    objectTitle: drilldown.title,
    linkRole: drilldown.role,
    evidenceTarget: "direct_movement",
    evidenceTargetLabel: drilldown.evidenceClassLabel,
    canonicalEvidenceDrilldown: drilldown,
  };
}

function revisionEvidenceToInspectorItem(args: {
  modelUpdateId: string;
  item: CanonicalProductConceptV1["evidence"][number];
}): InspectorEvidenceLinkItem {
  const drilldown = buildResultingRevisionEvidenceDrilldown(args);
  return {
    id: drilldown.selectionId,
    sourceTypeLabel: drilldown.sourceTypeLabel,
    evidenceSummaryLabel: drilldown.summary ?? drilldown.title,
    sourceObjectHref: null,
    createdAt: null,
    hasEvidence: true,
    sourceType: drilldown.sourceType,
    objectTitle: drilldown.title,
    linkRole: drilldown.role,
    evidenceTarget: "resulting_revision",
    evidenceTargetLabel: drilldown.evidenceClassLabel,
    canonicalEvidenceDrilldown: drilldown,
  };
}

function buildCanonicalInspectorProjection(args: {
  row: ModelUpdateDetailRow;
  movement: CanonicalProductConceptV1["movementHistory"][number];
  concept: CanonicalProductConceptV1;
  directEvidenceDrilldowns: CanonicalModelUpdateEvidenceDrilldownProjection[];
  movementRationale: string | null;
}): CanonicalModelUpdateInspectorProjection {
  const resultingRevision = args.concept.revisionHistory.find(
    (revision) => revision.id === args.movement.resultingRevisionId,
  );
  if (!resultingRevision) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical What Changed resulting revision missing from product history",
    );
  }

  const updateLabel = formatModelUpdateType(args.row.updateType as never);
  const displayedTitle = resolveModelUpdateDisplayTitle({
    userFacingSummary: args.movement.userFacingSummary,
    affectedObjectTitle: args.concept.title,
    packetTargetLabel: args.concept.summary,
    updateTypeLabel: updateLabel,
    affectedObjectTypeLabel: formatLinkedObjectType(
      UnderstandingLinkTargetType.canonical_concept_revision,
    ),
  });
  const summaryCandidate = firstMeaningfulModelUpdateText([
    args.movement.userFacingSummary,
  ]);
  const distinctSummary =
    summaryCandidate && normalizedLabel(summaryCandidate) !== normalizedLabel(displayedTitle)
      ? summaryCandidate
      : null;

  return {
    projectionType: "canonical_model_update_inspector",
    modelUpdateId: args.row.id,
    updateLabel,
    displayedTitle,
    distinctSummary,
    createdAt: args.row.createdAt.toISOString(),
    rationale: args.movementRationale ?? resultingRevision.rationale ?? null,
    before: args.movement.beforeSummary,
    after: args.movement.afterSummary,
    resultingStateAtPublication: {
      title: resultingRevision.title,
      summary: resultingRevision.summary,
      version: resultingRevision.version,
      acceptedAt: resultingRevision.acceptedAt,
    },
    currentUnderstandingNow: {
      title: args.concept.title,
      summary: args.concept.summary,
      version: args.concept.version,
      acceptedAt: args.concept.acceptedAt,
    },
    directMovementEvidence: args.directEvidenceDrilldowns.map((drilldown) =>
      movementEvidenceToInspectorItem(drilldown),
    ),
    resultingRevisionEvidence:
      args.concept.currentRevisionId === args.movement.resultingRevisionId
        ? args.concept.evidence.map((item) =>
            revisionEvidenceToInspectorItem({
              modelUpdateId: args.row.id,
              item,
            }),
          )
        : [],
    relatedObjects: [
      {
        selectionId: args.concept.conceptId,
        title: args.concept.title,
        inspectorObjectType: "canonical_concept",
      },
    ],
  };
}

type CanonicalEvidenceDrilldownIndex = ReadonlyMap<
  string,
  CanonicalModelUpdateEvidenceDrilldownProjection
>;

/**
 * Replaces one browser-visible evidence reference with its verified drill-down
 * projection. A reference with no safe projection is dropped rather than
 * rewritten, so an unsafe relationship can never reach the browser.
 */
function projectCanonicalReportEvidenceRef(args: {
  ref: RealityTrackingEvidenceRef;
  drilldownIndex: CanonicalEvidenceDrilldownIndex;
}): RealityTrackingEvidenceRef[] {
  const drilldown = args.drilldownIndex.get(args.ref.id);
  if (!drilldown) {
    return [];
  }

  return [
    {
      id: drilldown.selectionId,
      sourceType: drilldown.sourceType,
      sourceTypeLabel: drilldown.sourceTypeLabel,
      sourceId: drilldown.selectionId,
      role: drilldown.role,
      label: drilldown.title,
      href: null,
      createdAt: drilldown.recordedAt ?? args.ref.createdAt,
    },
  ];
}

function projectCanonicalReportClaim(args: {
  claim: RealityTrackingClaim;
  drilldownIndex: CanonicalEvidenceDrilldownIndex;
}): RealityTrackingClaim {
  const evidenceRefs = args.claim.evidenceRefs.flatMap((ref) =>
    projectCanonicalReportEvidenceRef({
      ref,
      drilldownIndex: args.drilldownIndex,
    }),
  );

  // Only a claim that lost every reference genuinely becomes unverified.
  const lostAllReferences =
    args.claim.evidenceRefs.length > 0 && evidenceRefs.length === 0;

  return {
    ...args.claim,
    evidenceStatus: lostAllReferences
      ? buildEvidenceStatus(evidenceRefs, args.claim.classification)
      : args.claim.evidenceStatus,
    evidenceRefs,
  };
}

function projectCanonicalReportSection<
  TSection extends RealityTrackingClaimSection,
>(section: TSection, drilldownIndex: CanonicalEvidenceDrilldownIndex): TSection {
  return {
    ...section,
    items: section.items.map((claim) =>
      projectCanonicalReportClaim({ claim, drilldownIndex }),
    ),
  };
}

/**
 * Applied after the deterministic report exists, so report prose, sections,
 * classifications, counts and conclusions stay derived from the original
 * verified packet.
 */
function projectCanonicalReportEvidenceReferences(args: {
  report: RealityTrackingModelMovementReport;
  drilldownIndex: CanonicalEvidenceDrilldownIndex;
}): RealityTrackingModelMovementReport {
  const index = args.drilldownIndex;

  return {
    ...args.report,
    facts: projectCanonicalReportSection(args.report.facts, index),
    stronglySupportedClaims: projectCanonicalReportSection(
      args.report.stronglySupportedClaims,
      index,
    ),
    inferences: projectCanonicalReportSection(args.report.inferences, index),
    speculations: projectCanonicalReportSection(args.report.speculations, index),
    overreachGuardrails: projectCanonicalReportSection(
      args.report.overreachGuardrails,
      index,
    ),
    loopPatternDetection: projectCanonicalReportSection(
      args.report.loopPatternDetection,
      index,
    ),
    modelMovement: projectCanonicalReportSection(args.report.modelMovement, index),
    realityGate: projectCanonicalReportSection(args.report.realityGate, index),
    fieldworkWatchFor: projectCanonicalReportSection(
      args.report.fieldworkWatchFor,
      index,
    ),
    reentryAction: projectCanonicalReportSection(args.report.reentryAction, index),
    whatWouldChangeThisConclusion: projectCanonicalReportSection(
      args.report.whatWouldChangeThisConclusion,
      index,
    ),
  };
}

function buildAffectedObjectDetail(args: {
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userMap: UserMapAffectedObjectRow | null;
  investigation: InvestigationAffectedObjectRow | null;
  fieldwork: FieldworkAffectedObjectRow | null;
  pattern: PatternAffectedObjectRow | null;
  contradiction: ContradictionAffectedObjectRow | null;
}): ModelMovementAffectedObject {
  if (args.affectedObjectType === "usermap_conclusion" && args.userMap) {
    return {
      type: "usermap_conclusion",
      title: args.userMap.title,
      summary: args.userMap.summary,
      statusLabel: formatUserMapStatus(args.userMap.status as never),
      confidenceLabel: formatUserMapConfidenceLevel(
        args.userMap.confidenceLevel as never
      ),
      evidenceCount: args.userMap.evidenceCount,
      sourceDiversity: args.userMap.sourceDiversity,
      timeSpreadDays: args.userMap.timeSpreadDays,
      correctionLabel: args.userMap.lastUserCorrectionLabel ?? null,
      detailHref: buildPublicObjectHref({
        type: "usermap_conclusion",
        id: args.userMap.id,
      }),
    };
  }

  if (args.affectedObjectType === "investigation" && args.investigation) {
    return {
      type: "investigation",
      title: args.investigation.title,
      summary:
        args.investigation.resolutionSummary ??
        args.investigation.organizingQuestion,
      statusLabel: formatInvestigationStatus(args.investigation.status as never),
      detailHref: buildPublicObjectHref({
        type: "investigation",
        id: args.investigation.id,
      }),
    };
  }

  if (args.affectedObjectType === "fieldwork_assignment" && args.fieldwork) {
    return {
      type: "fieldwork_assignment",
      title: args.fieldwork.prompt,
      summary: args.fieldwork.reason,
      statusLabel: formatFieldworkStatus(args.fieldwork.status as never),
      detailHref: buildPublicObjectHref({
        type: "fieldwork_assignment",
        id: args.fieldwork.id,
      }),
    };
  }

  if (args.affectedObjectType === "pattern_claim" && args.pattern) {
    return {
      type: "pattern_claim",
      title: truncateText(args.pattern.summary, 110),
      summary: args.pattern.summary,
      statusLabel: `${toTitleCase(args.pattern.status)} · ${toTitleCase(
        args.pattern.strengthLevel
      )}`,
      detailHref: buildPublicObjectHref({
        type: "pattern_claim",
        id: args.pattern.id,
      }),
    };
  }

  if (args.affectedObjectType === "contradiction_node" && args.contradiction) {
    return {
      type: "contradiction_node",
      title: args.contradiction.title,
      summary: `${args.contradiction.sideA} / ${args.contradiction.sideB}`,
      statusLabel: toTitleCase(args.contradiction.status),
      detailHref: buildPublicObjectHref({
        type: "contradiction_node",
        id: args.contradiction.id,
      }),
    };
  }

  return null;
}

function matchEvidence(
  packet: ModelMovementRealityPacket,
  predicate: (value: string) => boolean
): ModelMovementRealityPacketEvidence[] {
  return packet.evidence.filter((item) => predicate(item.analysisText?.toLowerCase() ?? ""));
}

function buildPacketSummary(
  packet: ModelMovementRealityPacket
): RealityTrackingModelMovementReport["evidencePacketSummary"] {
  const dateRangeLabel = formatDateRangeLabel([
    packet.modelUpdate.createdAt,
    ...packet.evidence.map((item) => item.createdAt),
  ]);
  const sourceTypeCount = new Set(packet.evidence.map((item) => item.sourceType)).size;
  const correctionCount =
    packet.affectedObject?.type === "usermap_conclusion" &&
    packet.affectedObject.correctionLabel
      ? 1
      : packet.recentMovements.filter((item) =>
          item.updateTypeLabel.toLowerCase().includes("correction")
        ).length;

  return {
    targetLabel:
      packet.affectedObject?.title ??
      packet.item.userFacingSummary,
    targetObjectTypeLabel: packet.item.affectedObjectTypeLabel,
    dateRangeLabel,
    receiptCount: packet.evidence.length,
    sourceTypeCount,
    linkedObjectCount:
      (packet.affectedObject ? 1 : 0) +
      new Set(
        packet.evidence
          .filter((item) => item.href)
          .map((item) => `${item.sourceType}:${item.sourceId}`)
      ).size,
    linkedDecisionCount: packet.relatedActions.length,
    activeQuestionCount: packet.affectedObject?.type === "investigation" ? 1 : 0,
    fieldworkCount: packet.relatedFieldwork.length,
    correctionCount,
    recentMovementCount: packet.recentMovements.length,
  };
}

const HIGH_INTENSITY_REGEX =
  /\b(always|never|everything|nothing|completely|totally|ruined|broken|hopeless|overwhelmed|fucking)\b/i;
const UNSUPPORTED_DIAGNOSIS_REGEX = /\bwhy am i like this\b/i;
const FLATTERY_REGEX =
  /\b(?:am i|i'm|im)\b[^.?!]{0,50}\bsmart\b[^.?!]{0,50}(?:right|really)?|\breally smart\b/i;
const VALIDATION_REGEX = /\bright\?\s*$|\bvalidation\b|\bam i actually\b/i;
const STOP_WEED_REGEX = /\bstop(?:ped|ping)?\s+weed\b/i;
const BUY_WEED_REGEX = /\b(?:buy|bought|buying)\s+weed\b/i;
const USE_WEED_REGEX = /\b(?:smoke|smoked|smoking)\b(?:\s+weed)?\b/i;
const IDENTITY_CLAIM_PREFIX_REGEX =
  /\b(?:i\s+(?:am|'m)|i\s+notice\s+i\s+am|i\s+realize\s+i\s+am|i\s+think\s+i\s+am|i\s+feel\s+like\s+i\s+am)\b/i;
const IDENTITY_CLAIM_TRANSIENT_REGEX =
  /\b(?:doing|working|trying|learning|getting|feeling|being|becoming|going|starting|stopping|recovering|stabiliz\w*|coping|dealing|handling|moving|thinking|talking|apologiz\w*|reflecting|navigating|improving|progressing|tired|sleepy|hungry|thirsty|sick|ill|sad|angry|mad|upset|anxious|nervous|worried|afraid|scared|panicked|overwhelmed|stressed|confused|frustrated|excited|happy|fine|okay|busy|late|in\s+(?:a\s+)?panic|depressed|lonely)\b/i;
const REALITY_GATE_PENDING_EVIDENCE_LABEL = "REALITY GATE: PENDING EVIDENCE";
const IDENTITY_CLAIM_REJECTED_LABEL = "IDENTITY CLAIM REJECTED";

function collectTopEvidence(packet: ModelMovementRealityPacket, limit = 3) {
  return packet.evidence.slice(0, limit);
}

function buildDeterministicSections(packet: ModelMovementRealityPacket) {
  const facts: RealityTrackingClaim[] = [];
  const supported: RealityTrackingClaim[] = [];
  const inferences: RealityTrackingClaim[] = [];
  const speculations: RealityTrackingClaim[] = [];
  const guardrails: RealityTrackingClaim[] = [];
  const loops: RealityTrackingClaim[] = [];
  const movement: RealityTrackingClaim[] = [];
  const gate: RealityTrackingClaim[] = [];
  const fieldwork: RealityTrackingClaim[] = [];
  const reentry: RealityTrackingClaim[] = [];
  const changes: RealityTrackingClaim[] = [];

  const topEvidence = collectTopEvidence(packet);
  const evidenceSourceTypes = new Set(packet.evidence.map((item) => item.sourceType));
  const emotionalEvidence = matchEvidence(packet, (value) => HIGH_INTENSITY_REGEX.test(value));
  const diagnosisEvidence = matchEvidence(packet, (value) =>
    UNSUPPORTED_DIAGNOSIS_REGEX.test(value)
  );
  const flatteryEvidence = matchEvidence(packet, (value) => FLATTERY_REGEX.test(value));
  const validationEvidence = matchEvidence(packet, (value) => VALIDATION_REGEX.test(value));
  const stopEvidence = matchEvidence(packet, (value) => STOP_WEED_REGEX.test(value));
  const buyEvidence = matchEvidence(packet, (value) => BUY_WEED_REGEX.test(value));
  const useEvidence = matchEvidence(packet, (value) => USE_WEED_REGEX.test(value));
  const hasWeedLoop =
    stopEvidence.length > 0 && buyEvidence.length > 0 && useEvidence.length > 0;
  const identityClaimDetected = hasIdentityClaim(packet);
  const identityClaimEvidence = matchEvidence(packet, (value) =>
    detectIdentityClaimText(value)
  );
  const identityClaimEvidenceRefs =
    identityClaimEvidence.length > 0 ? identityClaimEvidence : topEvidence;

  pushUniqueClaim(
    facts,
    makeClaim({
      text: `This movement is recorded as ${packet.modelUpdate.updateTypeLabel.toLowerCase()} on ${packet.modelUpdate.affectedObjectTypeLabel.toLowerCase()}.`,
      classification: "fact",
      evidence: topEvidence,
    })
  );

  if (packet.evidence.length > 0) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: `The linked packet contains ${packet.evidence.length} receipts across ${evidenceSourceTypes.size} source type${evidenceSourceTypes.size === 1 ? "" : "s"}.`,
        classification: "fact",
        evidence: topEvidence,
      })
    );
  }

  if (identityClaimDetected) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: "The packet contains identity-label language, but it does not yet show repeated behavioral evidence across distinct episodes.",
        classification: "fact",
        evidence: identityClaimEvidenceRefs,
      })
    );
  }

  if (emotionalEvidence.length > 0) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: "At least one linked receipt uses emotionally intense or global language.",
        classification: "fact",
        evidence: emotionalEvidence,
      })
    );
  }

  if (diagnosisEvidence.length > 0) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: "A linked receipt asks for a cause, but it does not present a repeated causal chain on its own.",
        classification: "fact",
        evidence: diagnosisEvidence,
      })
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: "A linked receipt asks for validation about competence rather than supplying external competence evidence.",
        classification: "fact",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  }

  if (hasWeedLoop) {
    pushUniqueClaim(
      facts,
      makeClaim({
        text: "Linked receipts show a stop intention, then a later purchase, then later use.",
        classification: "fact",
        evidence: [...stopEvidence, ...buyEvidence, ...useEvidence],
      })
    );
  }

  const enoughSupport =
    packet.evidence.length >= 3 && evidenceSourceTypes.size >= 2;
  if (packet.affectedObject && enoughSupport && !identityClaimDetected) {
    pushUniqueClaim(
      supported,
      makeClaim({
        text:
          packet.affectedObject.type === "usermap_conclusion"
            ? `Current model read: ${packet.affectedObject.summary}`
            : packet.affectedObject.summary,
        classification: "supported_claim",
        evidence: topEvidence,
      })
    );
  }

  if (packet.affectedObject?.type === "contradiction_node") {
    pushUniqueClaim(
      supported,
      makeClaim({
        text: `A tracked tension remains active between ${packet.affectedObject.summary}.`,
        classification: "supported_claim",
        evidence: topEvidence,
      })
    );
  }

  if (packet.modelUpdate.before && packet.modelUpdate.after) {
    pushUniqueClaim(
      inferences,
      makeClaim({
        text: `The model appears to have moved from “${packet.modelUpdate.before}” toward “${packet.modelUpdate.after}”.`,
        classification: "inference",
        evidence: topEvidence,
      })
    );
  }

  if (packet.relatedActions.length > 0) {
    const actionEvidence = packet.evidence.filter(
      (item) => item.sourceType === "surfaced_action"
    );
    pushUniqueClaim(
      inferences,
      makeClaim({
        text: "A recorded action outcome is part of the context around this movement.",
        classification: "inference",
        evidence: actionEvidence.length > 0 ? actionEvidence : topEvidence,
      })
    );
  }

  if (packet.evidence.length > 0 && evidenceSourceTypes.size === 1) {
    pushUniqueClaim(
      inferences,
      makeClaim({
        text: "The signal may still be local to one source family rather than stable across contexts.",
        classification: "inference",
        evidence: topEvidence,
      })
    );
  }

  if (diagnosisEvidence.length > 0) {
    pushUniqueClaim(
      speculations,
      makeClaim({
        text: "A deeper cause may involve state, environment, or timing, but the packet does not separate those yet.",
        classification: "speculation",
        evidence: diagnosisEvidence,
      })
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      speculations,
      makeClaim({
        text: "The validation request could reflect uncertainty, checking for feedback, or a momentary need for reassurance; the packet does not disambiguate which.",
        classification: "speculation",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  }

  if (packet.evidence.length < 3 || evidenceSourceTypes.size < 2) {
    pushUniqueClaim(
      speculations,
      makeClaim({
        text: "The linked packet is still thin enough that this movement may change materially with more receipts.",
        classification: "speculation",
        evidence: topEvidence,
      })
    );
  }

  if (identityClaimDetected) {
    pushUniqueClaim(
      guardrails,
      makeClaim({
        text: `${IDENTITY_CLAIM_REJECTED_LABEL}: missing behavioral evidence for a stable identity label; this packet does not yet show repeated behavioral evidence across distinct episodes.`,
        classification: "guardrail",
        evidence: identityClaimEvidenceRefs,
      })
    );
  } else {
    pushUniqueClaim(
      guardrails,
      makeClaim({
        text: "Do not turn this packet into an identity claim.",
        classification: "guardrail",
        evidence: topEvidence,
      })
    );
  }

  pushUniqueClaim(
    guardrails,
    makeClaim({
      text: "Do not infer diagnosis or deep historical cause without direct supporting evidence.",
      classification: "guardrail",
      evidence: diagnosisEvidence.length > 0 ? diagnosisEvidence : topEvidence,
    })
  );

  if (emotionalEvidence.length > 0) {
    pushUniqueClaim(
      guardrails,
      makeClaim({
        text: "Emotional intensity here is not proof of a stable trait or explanation.",
        classification: "guardrail",
        evidence: emotionalEvidence,
      })
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      guardrails,
      makeClaim({
        text: "A request for validation is not competence evidence by itself.",
        classification: "guardrail",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  }

  if (hasWeedLoop) {
    pushUniqueClaim(
      loops,
      makeClaim({
        text: "The packet shows a repeat loop: intention to stop, later purchase, then later use.",
        classification: "loop",
        evidence: [...stopEvidence, ...buyEvidence, ...useEvidence],
      })
    );
  } else if (packet.evidence.some((item) => item.sourceType === "pattern_claim")) {
    pushUniqueClaim(
      loops,
      makeClaim({
        text: "A linked pattern claim is already part of the evidence behind this movement.",
        classification: "loop",
        evidence: packet.evidence.filter((item) => item.sourceType === "pattern_claim"),
      })
    );
  } else if (packet.recentMovements.length > 0) {
    pushUniqueClaim(
      loops,
      makeClaim({
        text: "There have been multiple recent movements on the same object, which suggests ongoing re-evaluation.",
        classification: "loop",
        evidence: topEvidence,
      })
    );
  }

  pushUniqueClaim(
    movement,
    makeClaim({
      text: `Stored movement summary: ${packet.modelUpdate.userFacingSummary}`,
      classification: "movement",
      evidence: topEvidence,
    })
  );

  if (packet.modelUpdate.movementRationale?.trim()) {
    pushUniqueClaim(
      inferences,
      makeClaim({
        text: `Stored movement rationale: ${packet.modelUpdate.movementRationale.trim()}`,
        classification: "inference",
        evidence: topEvidence,
      })
    );
  }

  if (packet.modelUpdate.confidenceShift !== null) {
    pushUniqueClaim(
      movement,
      makeClaim({
        text: `Stored confidence shift: ${packet.modelUpdate.confidenceShift >= 0 ? "+" : ""}${packet.modelUpdate.confidenceShift.toFixed(2)}.`,
        classification: "movement",
        evidence: topEvidence,
      })
    );
  }

  if (packet.recentMovements.length > 0) {
    pushUniqueClaim(
      movement,
      makeClaim({
        text: `There ${packet.recentMovements.length === 1 ? "is" : "are"} ${packet.recentMovements.length} other recent movement update${packet.recentMovements.length === 1 ? "" : "s"} on this object.`,
        classification: "movement",
        evidence: topEvidence,
      })
    );
  }

  if (identityClaimDetected) {
    pushRealityGateClaim(
      gate,
      "capture repeated behavior across separate episodes before naming a stable identity.",
      identityClaimEvidenceRefs
    );
  }

  if (packet.evidence.length < 3) {
    pushRealityGateClaim(
      gate,
      "do not treat this as stable until there are at least three linked receipts.",
      topEvidence
    );
  }

  if (evidenceSourceTypes.size < 2) {
    pushRealityGateClaim(
      gate,
      "look for the same signal in a second source family or episode before strengthening the claim.",
      topEvidence
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushRealityGateClaim(
      gate,
      "competence claims require shipped work, repeated performance, or outside outcomes, not a single validation request.",
      [...flatteryEvidence, ...validationEvidence]
    );
  }

  if (diagnosisEvidence.length > 0) {
    pushRealityGateClaim(
      gate,
      "causal explanations require repeated before/after context, not a single why-question.",
      diagnosisEvidence
    );
  }

  for (const item of packet.relatedFieldwork) {
    pushUniqueClaim(
      fieldwork,
      makeClaim({
        text: `${item.prompt} ${item.reason ? `(${item.reason})` : ""}`.trim(),
        classification: "fieldwork",
        evidence: topEvidence,
      })
    );
  }

  if (fieldwork.length === 0 && identityClaimDetected) {
    pushUniqueClaim(
      fieldwork,
      makeClaim({
        text: "Capture the next timestamped instance with trigger, behavior, aftermath, and whether it repeats in a second context because the packet is missing behavioral evidence for a stable identity.",
        classification: "fieldwork",
        evidence: identityClaimEvidenceRefs,
      })
    );
  }

  if (fieldwork.length === 0 && hasWeedLoop) {
    pushUniqueClaim(
      fieldwork,
      makeClaim({
        text: "Before any purchase or use, capture body state, location, who is present, and the trigger pressure in the previous hour.",
        classification: "fieldwork",
        evidence: [...stopEvidence, ...buyEvidence, ...useEvidence],
      })
    );
  }

  if (fieldwork.length === 0 && diagnosisEvidence.length > 0) {
    pushUniqueClaim(
      fieldwork,
      makeClaim({
        text: "On the next occurrence, capture the trigger, body state, context, and what happened in the 30 minutes before the question shows up.",
        classification: "fieldwork",
        evidence: diagnosisEvidence,
      })
    );
  }

  if (fieldwork.length === 0) {
    pushUniqueClaim(
      fieldwork,
      makeClaim({
        text: "Capture the next instance with trigger, behavior, aftermath, and whether it repeats in a second context.",
        classification: "fieldwork",
        evidence: topEvidence,
      })
    );
  }

  if (packet.relatedFieldwork.length > 0) {
    pushUniqueClaim(
      reentry,
      makeClaim({
        text: "Open the linked watch-for prompt and record the next live instance before adjusting the model again.",
        classification: "reentry",
        evidence: topEvidence,
      })
    );
  } else if (hasWeedLoop) {
    pushUniqueClaim(
      reentry,
      makeClaim({
        text: "Record the next stop intention, purchase cue, and use context as separate receipts instead of folding them into one story.",
        classification: "reentry",
        evidence: [...stopEvidence, ...buyEvidence, ...useEvidence],
      })
    );
  } else if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      reentry,
      makeClaim({
        text: "Check one concrete shipped outcome or observable result before evaluating competence.",
        classification: "reentry",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  } else if (identityClaimDetected) {
    pushUniqueClaim(
      reentry,
      makeClaim({
        text: "Read the repeated behavior receipts first; the packet is still missing behavioral evidence for an identity conclusion.",
        classification: "reentry",
        evidence: identityClaimEvidenceRefs,
      })
    );
  } else {
    pushUniqueClaim(
      reentry,
      makeClaim({
        text: "Read the most recent linked receipt before changing the object summary.",
        classification: "reentry",
        evidence: topEvidence,
      })
    );
  }

  if (hasWeedLoop) {
    pushUniqueClaim(
      changes,
      makeClaim({
        text: "A later stop attempt followed by no purchase or use would weaken the loop interpretation.",
        classification: "change_condition",
        evidence: [...stopEvidence, ...buyEvidence, ...useEvidence],
      })
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      changes,
      makeClaim({
        text: "Concrete shipped outcomes, repeatable performance, or outside feedback would strengthen any competence conclusion.",
        classification: "change_condition",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  }

  if (diagnosisEvidence.length > 0) {
    pushUniqueClaim(
      changes,
      makeClaim({
        text: "Repeated before/after context showing the same cue-to-state chain would strengthen a causal explanation.",
        classification: "change_condition",
        evidence: diagnosisEvidence,
      })
    );
  }

  if (identityClaimDetected) {
    pushUniqueClaim(
      changes,
      makeClaim({
        text: "Repeated behavior across distinct episodes, rather than a single self-label, would change this conclusion.",
        classification: "change_condition",
        evidence: identityClaimEvidenceRefs,
      })
    );
  }

  pushUniqueClaim(
    changes,
    makeClaim({
      text: "A direct disconfirming receipt, or more receipts across distinct episodes, would materially change this conclusion.",
      classification: "change_condition",
      evidence: topEvidence,
    })
  );

  return {
    facts,
    supported,
    inferences,
    speculations,
    guardrails,
    loops,
    movement,
    gate,
    fieldwork,
    reentry,
    changes,
  };
}

export function buildDeterministicModelMovementRealityReport(
  packet: ModelMovementRealityPacket
): RealityTrackingModelMovementReport {
  const sections = buildDeterministicSections(packet);

  return {
    contractVersion: REALITY_TRACKING_OUTPUT_CONTRACT_VERSION,
    promptVersion: REALITY_TRACKING_OUTPUT_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    generator: "deterministic_fallback",
    evidencePacketSummary: buildPacketSummary(packet),
    facts: {
      items: sections.facts,
      emptyState: "No direct facts are available from the linked packet yet.",
    },
    stronglySupportedClaims: {
      items: sections.supported,
      emptyState:
        "Linked evidence is not strong enough yet to promote a stronger claim beyond the stored movement.",
    },
    inferences: {
      items: sections.inferences,
      emptyState: "No additional inference is justified beyond the stored movement.",
    },
    speculations: {
      items: sections.speculations,
      emptyState: "No extra speculation is needed beyond the recorded uncertainty.",
    },
    overreachGuardrails: {
      items: sections.guardrails,
      emptyState: null,
    },
    loopPatternDetection: {
      items: sections.loops,
      emptyState: "No repeat structure is visible from the linked packet yet.",
    },
    modelMovement: {
      items: sections.movement,
      emptyState: "No additional movement detail is available beyond the stored update.",
      before: packet.modelUpdate.before,
      after: packet.modelUpdate.after,
      confidenceShift: packet.modelUpdate.confidenceShift,
    },
    realityGate: {
      items: sections.gate,
      emptyState: REALITY_GATE_PENDING_EVIDENCE_LABEL,
    },
    fieldworkWatchFor: {
      items: sections.fieldwork,
      emptyState: "No fieldwork is available yet.",
    },
    reentryAction: {
      items: sections.reentry,
      emptyState: "No immediate re-entry action is available yet.",
    },
    whatWouldChangeThisConclusion: {
      items: sections.changes,
      emptyState: "No explicit disconfirmation condition is available yet.",
    },
  };
}

export async function buildWhatChangedInspectorDetail(args: {
  userId: string;
  modelUpdateId: string;
  db?: WhatChangedRealityReportDb;
}): Promise<InspectorModelUpdateDetail | null> {
  const db = args.db ?? (prismadb as unknown as WhatChangedRealityReportDb);
  const authorityDb = (args.db ?? prismadb) as unknown as typeof prismadb;

  const row = await db.modelUpdate.findFirst({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    },
    select: {
      id: true,
      updateType: true,
      affectedObjectType: true,
      affectedObjectId: true,
      userFacingSummary: true,
      createdAt: true,
      beforeSummary: true,
      afterSummary: true,
      confidenceDelta: true,
      internalNotes: true,
      canonicalConceptId: true,
      previousRevisionId: true,
      resultingRevisionId: true,
      exploreProposalId: true,
    },
  });

  if (!row) {
    return null;
  }

  let beforeSummary = row.beforeSummary;
  let afterSummary = row.afterSummary;
  let canonicalConcept: CanonicalProductConceptV1 | null = null;
  let canonicalMovement: CanonicalProductConceptV1["movementHistory"][number] | null =
    null;

  const deterministicMatches =
    await findCanonicalProposalsByDeterministicModelUpdateId({
      userId: args.userId,
      modelUpdateId: row.id,
      db: authorityDb,
    });
  const deterministicOwner =
    requireSingleDeterministicCanonicalProposal(deterministicMatches);

  const proposalLookup =
    deterministicOwner ??
    (await authorityDb.exploreMovementProposal.findFirst({
      where: {
        userId: args.userId,
        OR: [
          { modelUpdateId: row.id },
          ...(row.exploreProposalId ? [{ id: row.exploreProposalId }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        status: true,
        authorityMode: true,
        modelUpdateId: true,
        canonicalConceptId: true,
      },
    }));

  const proposalIsCanonicalV1 =
    proposalLookup?.authorityMode === ExploreMovementAuthorityMode.canonical_v1;
  const deterministicMatchesRow =
    Boolean(deterministicOwner) ||
    (proposalLookup != null &&
      deriveExploreMovementModelUpdateId(proposalLookup.id) === row.id);

  const isCanonicalReceipt =
    Boolean(row.canonicalConceptId) ||
    Boolean(row.previousRevisionId) ||
    Boolean(row.resultingRevisionId) ||
    Boolean(row.exploreProposalId) ||
    row.affectedObjectType ===
      UnderstandingLinkTargetType.canonical_concept_revision ||
    Boolean(proposalIsCanonicalV1 && proposalLookup?.modelUpdateId === row.id) ||
    Boolean(deterministicMatchesRow);

  if (isCanonicalReceipt) {
    const { readCanonicalProductConceptForUser } = await import(
      "./current-understanding-product-projection"
    );

    if (
      !row.canonicalConceptId ||
      !row.previousRevisionId ||
      !row.resultingRevisionId ||
      !row.exploreProposalId ||
      row.affectedObjectType !==
        UnderstandingLinkTargetType.canonical_concept_revision
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed receipt has incomplete lineage identity",
      );
    }

    if (
      !proposalLookup ||
      proposalLookup.userId !== args.userId ||
      proposalLookup.authorityMode !== ExploreMovementAuthorityMode.canonical_v1 ||
      proposalLookup.status !== ExploreMovementProposalStatus.published ||
      proposalLookup.canonicalConceptId !== row.canonicalConceptId ||
      deriveExploreMovementModelUpdateId(proposalLookup.id) !== row.id ||
      proposalLookup.id !== row.exploreProposalId
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed proposal identity mismatch",
      );
    }

    // Prefer deterministic ownership over mutable proposal.modelUpdateId pointer.
    if (
      proposalLookup.modelUpdateId !== row.id &&
      !deterministicOwner
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed proposal modelUpdateId mismatch without deterministic ownership",
      );
    }

    const concept = await readCanonicalProductConceptForUser({
      userId: args.userId,
      conceptId: row.canonicalConceptId,
      db: authorityDb,
    });
    if (concept === "not_found") {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed target concept not found",
      );
    }
    if (
      !Array.isArray(concept.movementHistory) ||
      !Array.isArray(concept.revisionHistory) ||
      !Array.isArray(concept.evidence)
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed product projection is incomplete",
      );
    }
    const movement = concept.movementHistory.find(
      (entry) => entry.modelUpdateId === row.id,
    );
    const previousRevision = concept.revisionHistory.find(
      (revision) => revision.id === row.previousRevisionId,
    );
    const resultingRevision = concept.revisionHistory.find(
      (revision) => revision.id === row.resultingRevisionId,
    );
    if (
      !movement ||
      !previousRevision ||
      !resultingRevision ||
      movement.exploreProposalId !== row.exploreProposalId ||
      movement.previousRevisionId !== row.previousRevisionId ||
      movement.resultingRevisionId !== row.resultingRevisionId ||
      movement.beforeSummary !== row.beforeSummary ||
      movement.afterSummary !== row.afterSummary ||
      movement.beforeSummary !== previousRevision.summary ||
      movement.afterSummary !== resultingRevision.summary ||
      movement.userFacingSummary !== row.userFacingSummary ||
      movement.updateType !== row.updateType ||
      movement.createdAt !== row.createdAt.toISOString() ||
      concept.conceptId !== row.canonicalConceptId ||
      row.affectedObjectId !== movement.resultingRevisionId
    ) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "Canonical What Changed movement does not match projection",
      );
    }
    beforeSummary = movement.beforeSummary;
    afterSummary = movement.afterSummary;
    canonicalConcept = concept;
    canonicalMovement = movement;
  }

  const baseItem = toWhatChangedListItem(row as never);
  if (!baseItem) {
    return null;
  }

  const [verifiedItemRaw] = await applyVerifiedAffectedObjectHrefs({
    userId: args.userId,
    items: [baseItem],
  });

  if (!verifiedItemRaw) {
    return null;
  }

  const verifiedItem =
    canonicalConcept && canonicalMovement
      ? {
          ...verifiedItemRaw,
          affectedObjectId: null,
          affectedObjectHref: null,
        }
      : verifiedItemRaw;

  const movementEvidenceSelect = {
    id: true,
    sourceType: true,
    sourceId: true,
    role: true,
    summary: true,
    snippet: true,
    quote: true,
    weight: true,
    confidenceContribution: true,
    createdAt: true,
  } as const;

  const movementEvidenceRows = await db.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: "model_update",
      targetId: row.id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MOVEMENT_EVIDENCE_LINK_LIMIT,
    select: movementEvidenceSelect,
  });
  const affectedObjectEvidenceRows =
    canonicalConcept && canonicalMovement
      ? []
      : await db.understandingEvidenceLink.findMany({
          where: {
            userId: args.userId,
            targetType: row.affectedObjectType,
            targetId: row.affectedObjectId,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: MOVEMENT_EVIDENCE_LINK_LIMIT,
          select: movementEvidenceSelect,
        });

  const evidenceRows = mergeMovementEvidenceLinkRows(
    movementEvidenceRows,
    affectedObjectEvidenceRows
  );

  const sourceIdsByType = new Map<UnderstandingLinkSourceType, string[]>();
  for (const link of evidenceRows) {
    const list = sourceIdsByType.get(link.sourceType) ?? [];
    list.push(link.sourceId);
    sourceIdsByType.set(link.sourceType, list);
  }

  const [
    userMap,
    investigation,
    fieldwork,
    pattern,
    contradiction,
    visiblePatterns,
    visibleContradictions,
    surfacedActions,
    journalEntries,
    messages,
    quickCheckIns,
    sessions,
    relatedFieldwork,
    recentMovements,
  ] = await Promise.all([
    row.affectedObjectType === "usermap_conclusion"
      ? db.userMapConclusion.findFirst({
          where: {
            id: row.affectedObjectId,
            userId: args.userId,
            visibility: UserMapConclusionVisibility.user_visible,
          },
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            confidenceLevel: true,
            evidenceCount: true,
            sourceDiversity: true,
            timeSpreadDays: true,
            lastUserCorrectionAt: true,
            lastUserCorrectionLabel: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    row.affectedObjectType === "investigation"
      ? db.investigation.findFirst({
          where: {
            id: row.affectedObjectId,
            userId: args.userId,
            visibility: "user_visible",
            status: {
              in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
            },
          },
          select: {
            id: true,
            title: true,
            organizingQuestion: true,
            status: true,
            priority: true,
            resolutionSummary: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    row.affectedObjectType === "fieldwork_assignment"
      ? db.fieldworkAssignment.findFirst({
          where: {
            id: row.affectedObjectId,
            ...buildPublicWatchForWhere({ userId: args.userId }),
          },
          select: {
            id: true,
            prompt: true,
            reason: true,
            status: true,
            observationOutcome: true,
            observationNote: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    row.affectedObjectType === "pattern_claim"
      ? db.patternClaim.findFirst({
          where: {
            id: row.affectedObjectId,
            userId: args.userId,
            status: { in: [PatternClaimStatus.active, PatternClaimStatus.paused] },
          },
          select: {
            id: true,
            summary: true,
            status: true,
            strengthLevel: true,
          },
        })
      : Promise.resolve(null),
    row.affectedObjectType === "contradiction_node"
      ? db.contradictionNode.findFirst({
          where: {
            id: row.affectedObjectId,
            userId: args.userId,
            status: { not: ContradictionStatus.candidate },
          },
          select: {
            id: true,
            title: true,
            sideA: true,
            sideB: true,
            status: true,
            evidenceCount: true,
            lastEvidenceAt: true,
            lastTouchedAt: true,
          },
        })
      : Promise.resolve(null),
    (sourceIdsByType.get("pattern_claim") ?? []).length > 0
      ? db.patternClaim.findMany({
          where: {
            userId: args.userId,
            status: { not: PatternClaimStatus.candidate },
            id: { in: uniqueBy(sourceIdsByType.get("pattern_claim") ?? [], (id) => id) },
          },
          select: {
            id: true,
            summary: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("contradiction_node") ?? []).length > 0
      ? db.contradictionNode.findMany({
          where: {
            userId: args.userId,
            status: { not: ContradictionStatus.candidate },
            id: {
              in: uniqueBy(
                sourceIdsByType.get("contradiction_node") ?? [],
                (id) => id
              ),
            },
          },
          select: {
            id: true,
            title: true,
            sideA: true,
            sideB: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("surfaced_action") ?? []).length > 0
      ? db.surfacedAction.findMany({
          where: {
            userId: args.userId,
            id: { in: uniqueBy(sourceIdsByType.get("surfaced_action") ?? [], (id) => id) },
          },
          select: {
            id: true,
            bucket: true,
            status: true,
            note: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("journal_entry") ?? []).length > 0
      ? db.journalEntry.findMany({
          where: {
            userId: args.userId,
            id: { in: uniqueBy(sourceIdsByType.get("journal_entry") ?? [], (id) => id) },
          },
          select: {
            id: true,
            title: true,
            body: true,
            authoredAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("message") ?? []).length > 0
      ? db.message.findMany({
          where: {
            userId: args.userId,
            id: { in: uniqueBy(sourceIdsByType.get("message") ?? [], (id) => id) },
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sessionId: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("quick_check_in") ?? []).length > 0
      ? db.quickCheckIn.findMany({
          where: {
            userId: args.userId,
            id: { in: uniqueBy(sourceIdsByType.get("quick_check_in") ?? [], (id) => id) },
          },
          select: {
            id: true,
            stateTag: true,
            eventTags: true,
            note: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    (sourceIdsByType.get("session") ?? []).length > 0
      ? db.session.findMany({
          where: {
            userId: args.userId,
            id: { in: uniqueBy(sourceIdsByType.get("session") ?? [], (id) => id) },
          },
          select: {
            id: true,
            label: true,
            surfaceType: true,
            startedAt: true,
          },
        })
      : Promise.resolve([]),
    db.fieldworkAssignment.findMany({
      where: {
        ...buildPublicWatchForWhere({ userId: args.userId }),
        linkedObjectType: row.affectedObjectType,
        linkedObjectId: row.affectedObjectId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        id: true,
        prompt: true,
        reason: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.modelUpdate.findMany({
      where: {
        userId: args.userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
        affectedObjectType: row.affectedObjectType,
        affectedObjectId: row.affectedObjectId,
        id: { not: row.id },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        id: true,
        updateType: true,
        userFacingSummary: true,
        createdAt: true,
      },
    }),
  ]);

  const patternById = new Map(visiblePatterns.map((item) => [item.id, item]));
  const contradictionById = new Map(
    visibleContradictions.map((item) => [item.id, item])
  );
  const actionById = new Map(surfacedActions.map((item) => [item.id, item]));
  const journalById = new Map(journalEntries.map((item) => [item.id, item]));
  const messageById = new Map(messages.map((item) => [item.id, item]));
  const quickCheckInById = new Map(quickCheckIns.map((item) => [item.id, item]));
  const sessionById = new Map(sessions.map((item) => [item.id, item]));
  const visiblePatternIds = new Set(visiblePatterns.map((item) => item.id));
  const visibleContradictionIds = new Set(
    visibleContradictions.map((item) => item.id)
  );

  const resolvedEvidenceSourceIds: ResolvedEvidenceSourceIds = new Map<
    UnderstandingLinkSourceType,
    ReadonlySet<string>
  >([
    ["pattern_claim", new Set(patternById.keys())],
    ["contradiction_node", new Set(contradictionById.keys())],
    ["surfaced_action", new Set(actionById.keys())],
    ["journal_entry", new Set(journalById.keys())],
    ["message", new Set(messageById.keys())],
    ["quick_check_in", new Set(quickCheckInById.keys())],
    ["session", new Set(sessionById.keys())],
  ]);

  const eligibleEvidenceRelationshipIds = new Set(
    evidenceRows
      .filter((link) =>
        canonicalEvidenceSourceIsEligible({
          sourceType: link.sourceType,
          sourceId: link.sourceId,
          resolvedSourceIds: resolvedEvidenceSourceIds,
        }),
      )
      .map((link) => link.id),
  );

  const evidence: ModelMovementRealityPacketEvidence[] = evidenceRows.map((link) => {
    const safeSummary = safeCanonicalEvidenceText(link.summary);
    const safeSnippet = safeCanonicalEvidenceText(link.snippet);
    const sourceDisclosure: CanonicalModelUpdateEvidenceDisclosure =
      eligibleEvidenceRelationshipIds.has(link.id) && (safeSummary || safeSnippet)
        ? "available"
        : "unavailable";
    return {
      id: link.id,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      role: link.role,
      createdAt: link.createdAt.toISOString(),
      sourceTypeLabel: sourceTypeLabel(link.sourceType),
      displayLabel: buildDisplayLabel({
        link,
        patternById,
        contradictionById,
        actionById,
        journalById,
        messageById,
        quickCheckInById,
        sessionById,
      }),
      href: buildSourceHref(
        link.sourceType,
        link.sourceId,
        visiblePatternIds,
        visibleContradictionIds
      ),
      analysisText: buildAnalysisText({
        link,
        patternById,
        contradictionById,
        actionById,
        journalById,
        messageById,
        quickCheckInById,
        sessionById,
      }),
      safeSummary,
      safeSnippet,
      sourceDisclosure,
    };
  });

  const affectedObject = buildAffectedObjectDetail({
    affectedObjectType: row.affectedObjectType,
    affectedObjectId: row.affectedObjectId,
    userMap,
    investigation,
    fieldwork,
    pattern,
    contradiction,
  });

  const movementRationale = decodeMovementRationaleFromInternalNotes(row.internalNotes);
  const canonicalEvidenceDrilldownIndex =
    canonicalConcept && canonicalMovement
      ? buildDirectMovementEvidenceDrilldownIndex({
          modelUpdateId: row.id,
          directEvidence: evidence,
          eligibleRelationshipIds: eligibleEvidenceRelationshipIds,
        })
      : null;
  const canonicalInspectorProjection =
    canonicalConcept && canonicalMovement && canonicalEvidenceDrilldownIndex
      ? buildCanonicalInspectorProjection({
          row,
          movement: canonicalMovement,
          concept: canonicalConcept,
          directEvidenceDrilldowns: [
            ...canonicalEvidenceDrilldownIndex.values(),
          ],
          movementRationale,
        })
      : null;

  const packet: ModelMovementRealityPacket = {
    item: verifiedItem,
    modelUpdate: {
      id: row.id,
      updateTypeLabel: formatModelUpdateType(row.updateType as never),
      affectedObjectType: row.affectedObjectType,
      affectedObjectTypeLabel: formatLinkedObjectType(row.affectedObjectType),
      userFacingSummary: row.userFacingSummary,
      createdAt: row.createdAt.toISOString(),
      before: beforeSummary,
      after: afterSummary,
      confidenceShift: row.confidenceDelta,
      movementRationale,
    },
    affectedObject,
    evidence,
    relatedFieldwork: relatedFieldwork.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      reason: item.reason,
      statusLabel: formatFieldworkStatus(item.status as never),
      updatedAt: item.updatedAt.toISOString(),
    })),
    relatedActions: surfacedActions.map((item) => ({
      id: item.id,
      label: item.note
        ? truncateText(item.note, 100)
        : `Action outcome · ${toTitleCase(item.bucket)}`,
      statusLabel: toTitleCase(item.status),
      updatedAt: item.updatedAt.toISOString(),
    })),
    recentMovements: recentMovements.map((item) => ({
      id: item.id,
      updateTypeLabel: formatModelUpdateType(item.updateType as never),
      userFacingSummary: item.userFacingSummary,
      createdAt: item.createdAt.toISOString(),
    })),
  };
  const report = buildDeterministicModelMovementRealityReport(packet);

  return {
    item: verifiedItem,
    report:
      canonicalInspectorProjection && canonicalEvidenceDrilldownIndex
        ? projectCanonicalReportEvidenceReferences({
            report,
            drilldownIndex: canonicalEvidenceDrilldownIndex,
          })
        : report,
    ...(canonicalInspectorProjection ? { canonicalInspectorProjection } : {}),
  };
}
