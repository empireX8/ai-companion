import "server-only";

import {
  ContradictionStatus,
  ModelUpdateVisibility,
  PatternClaimStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkRole,
  type UnderstandingLinkSourceType,
  type UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "./prismadb";

import {
  REALITY_TRACKING_OUTPUT_CONTRACT_VERSION,
  REALITY_TRACKING_OUTPUT_PROMPT_VERSION,
  type RealityTrackingClaim,
  type RealityTrackingClaimClassification,
  type RealityTrackingEvidenceRef,
  type RealityTrackingEvidenceStatus,
  type RealityTrackingModelMovementReport,
} from "./reality-tracking-output-contract";
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

function buildEvidenceStatus(
  refs: RealityTrackingEvidenceRef[]
): RealityTrackingEvidenceStatus {
  if (refs.length === 0) {
    return "insufficient";
  }

  const sourceTypeCount = new Set(refs.map((ref) => ref.sourceType)).size;
  if (refs.length >= 3 && sourceTypeCount >= 2) {
    return "corroborated";
  }
  if (refs.length >= 2) {
    return "mixed";
  }
  return "direct";
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
    evidenceStatus: buildEvidenceStatus(refs),
    evidenceRefs: refs,
  };
}

function pushUniqueClaim(list: RealityTrackingClaim[], claim: RealityTrackingClaim) {
  if (!list.some((item) => item.text === claim.text)) {
    list.push(claim);
  }
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

  pushUniqueClaim(
    facts,
    makeClaim({
      text: `This movement is recorded as ${packet.modelUpdate.updateTypeLabel.toLowerCase()} on ${packet.modelUpdate.affectedObjectTypeLabel.toLowerCase()}.`,
      classification: "fact",
      evidence: topEvidence,
    })
  );

  pushUniqueClaim(
    facts,
    makeClaim({
      text: `The linked packet contains ${packet.evidence.length} receipts across ${evidenceSourceTypes.size} source type${evidenceSourceTypes.size === 1 ? "" : "s"}.`,
      classification: "fact",
      evidence: topEvidence,
    })
  );

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
  if (packet.affectedObject && enoughSupport) {
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

  pushUniqueClaim(
    guardrails,
    makeClaim({
      text: "Do not turn this packet into an identity claim.",
      classification: "guardrail",
      evidence: topEvidence,
    })
  );

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

  if (packet.evidence.length < 3) {
    pushUniqueClaim(
      gate,
      makeClaim({
        text: "Do not treat this as stable until there are at least three linked receipts.",
        classification: "reality_gate",
        evidence: topEvidence,
      })
    );
  }

  if (evidenceSourceTypes.size < 2) {
    pushUniqueClaim(
      gate,
      makeClaim({
        text: "Look for the same signal in a second source family or episode before strengthening the claim.",
        classification: "reality_gate",
        evidence: topEvidence,
      })
    );
  }

  if (flatteryEvidence.length > 0 || validationEvidence.length > 0) {
    pushUniqueClaim(
      gate,
      makeClaim({
        text: "Competence claims require shipped work, repeated performance, or outside outcomes, not a single validation request.",
        classification: "reality_gate",
        evidence: [...flatteryEvidence, ...validationEvidence],
      })
    );
  }

  if (diagnosisEvidence.length > 0) {
    pushUniqueClaim(
      gate,
      makeClaim({
        text: "Causal explanations require repeated before/after context, not a single why-question.",
        classification: "reality_gate",
        evidence: diagnosisEvidence,
      })
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
      emptyState: "No stronger reality gate is available beyond keeping this inspectable and corrigible.",
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
}): Promise<{ item: WhatChangedListItem; report: RealityTrackingModelMovementReport } | null> {
  const db = args.db ?? (prismadb as unknown as WhatChangedRealityReportDb);

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
    },
  });

  if (!row) {
    return null;
  }

  const baseItem = toWhatChangedListItem(row as never);
  if (!baseItem) {
    return null;
  }

  const [verifiedItem] = await applyVerifiedAffectedObjectHrefs({
    userId: args.userId,
    items: [baseItem],
  });

  if (!verifiedItem) {
    return null;
  }

  const evidenceRows = await db.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: "model_update",
      targetId: row.id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 12,
    select: {
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
    },
  });

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

  const evidence = evidenceRows.map((link) => ({
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
  }));

  const affectedObject = buildAffectedObjectDetail({
    affectedObjectType: row.affectedObjectType,
    affectedObjectId: row.affectedObjectId,
    userMap,
    investigation,
    fieldwork,
    pattern,
    contradiction,
  });

  const packet: ModelMovementRealityPacket = {
    item: verifiedItem,
    modelUpdate: {
      id: row.id,
      updateTypeLabel: formatModelUpdateType(row.updateType as never),
      affectedObjectType: row.affectedObjectType,
      affectedObjectTypeLabel: formatLinkedObjectType(row.affectedObjectType),
      userFacingSummary: row.userFacingSummary,
      createdAt: row.createdAt.toISOString(),
      before: row.beforeSummary,
      after: row.afterSummary,
      confidenceShift: row.confidenceDelta,
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

  return {
    item: verifiedItem,
    report: buildDeterministicModelMovementRealityReport(packet),
  };
}
