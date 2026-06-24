import "server-only";

import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  InvestigationVisibility,
  ModelUpdateVisibility,
  PatternClaimStatus,
  ReferenceStatus,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
  type ReferenceType,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  EXPLORE_CONVERSATION_REVIEW_LIMIT,
  EXPLORE_REVIEW_KIND_LABELS,
  type ExploreConversationReviewItem,
  type ExploreConversationReviewItemKind,
  type ExploreConversationReviewStatus,
} from "./explore-conversation-review";
import {
  buildPublicObjectHref,
  formatPublicObjectLinkTypeLabel,
  toNonEmptyPublicId,
} from "./public-continuity-registry";
import {
  formatFieldworkStatus,
  formatInvestigationStatus,
  formatModelUpdateType,
  formatUserMapArea,
  formatUserMapConfidenceLevel,
} from "./public-intelligence-safe-slice";

const REVIEW_CANDIDATE_LIFECYCLE_STATUSES: CandidateLifecycleStatus[] = [
  CandidateLifecycleStatus.proposed,
  CandidateLifecycleStatus.held_for_more_evidence,
];

const TITLE_MAX = 120;
const SUMMARY_MAX = 220;

function clampText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function reviewStatusFromLifecycle(
  lifecycle: CandidateLifecycleStatus
): { status: ExploreConversationReviewStatus; statusLabel: string } {
  if (lifecycle === CandidateLifecycleStatus.proposed) {
    return { status: "draft", statusLabel: "Draft" };
  }
  if (lifecycle === CandidateLifecycleStatus.held_for_more_evidence) {
    return { status: "deferred", statusLabel: "Needs more evidence" };
  }
  return { status: "needs_review", statusLabel: "Needs review" };
}

function readOnlyActions() {
  return {
    canConfirm: false,
    canEdit: false,
    canReject: false,
  };
}

function referenceReviewActions() {
  return {
    canConfirm: true,
    canEdit: false,
    canReject: true,
  };
}

function referenceKindForType(type: ReferenceType): ExploreConversationReviewItemKind {
  if (type === "preference" || type === "constraint") {
    return "context_profile_update";
  }
  if (type === "pattern") {
    return "pattern_signal";
  }
  return "receipt_extracted";
}

function referenceSourceLabel(type: ReferenceType): string {
  if (type === "preference") {
    return "Preference from conversation";
  }
  if (type === "constraint") {
    return "Constraint from conversation";
  }
  return "Captured from conversation";
}

function confidenceLabelFromReference(confidence: string): string {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`;
}

async function loadExploreSessionMessageIds(args: {
  userId: string;
  sessionId: string;
}): Promise<{ messageIds: string[] } | "session_not_found"> {
  const session = await prismadb.session.findFirst({
    where: {
      id: args.sessionId,
      userId: args.userId,
      surfaceType: "explore_chat",
    },
    select: { id: true },
  });

  if (!session) {
    return "session_not_found";
  }

  const messages = await prismadb.message.findMany({
    where: {
      sessionId: args.sessionId,
      userId: args.userId,
    },
    select: { id: true },
  });

  return { messageIds: messages.map((message) => message.id) };
}

export async function listExploreSessionConversationReviewItems(args: {
  userId: string;
  sessionId: string;
  limit?: number;
}): Promise<ExploreConversationReviewItem[] | "session_not_found"> {
  const limit = args.limit ?? EXPLORE_CONVERSATION_REVIEW_LIMIT;
  const sessionContext = await loadExploreSessionMessageIds(args);

  if (sessionContext === "session_not_found") {
    return "session_not_found";
  }

  const { messageIds } = sessionContext;
  const sessionSourceFilters: Array<{
    sourceType: UnderstandingLinkSourceType;
    sourceId: string | { in: string[] };
  }> = [
    {
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.sessionId,
    },
  ];

  if (messageIds.length > 0) {
    sessionSourceFilters.push({
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: { in: messageIds },
    });
  }

  const [
    referenceRows,
    evidenceLinks,
    contradictionRows,
    patternEvidenceRows,
  ] = await Promise.all([
    prismadb.referenceItem.findMany({
      where: {
        userId: args.userId,
        status: ReferenceStatus.candidate,
        OR: [
          { sourceSessionId: args.sessionId },
          ...(messageIds.length > 0
            ? [{ sourceMessageId: { in: messageIds } }]
            : []),
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        type: true,
        confidence: true,
        statement: true,
        updatedAt: true,
      },
    }),
    prismadb.understandingEvidenceLink.findMany({
      where: {
        userId: args.userId,
        OR: sessionSourceFilters,
      },
      select: {
        targetType: true,
        targetId: true,
      },
    }),
    prismadb.contradictionNode.findMany({
      where: {
        userId: args.userId,
        OR: [
          { sourceSessionId: args.sessionId },
          ...(messageIds.length > 0
            ? [{ sourceMessageId: { in: messageIds } }]
            : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        sideA: true,
        sideB: true,
        status: true,
        createdAt: true,
      },
    }),
    messageIds.length > 0
      ? prismadb.patternClaimEvidence.findMany({
          where: {
            OR: [
              { sessionId: args.sessionId },
              { messageId: { in: messageIds } },
            ],
            claim: {
              userId: args.userId,
              status: PatternClaimStatus.candidate,
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit,
          select: {
            claimId: true,
            claim: {
              select: {
                id: true,
                summary: true,
                strengthLevel: true,
                updatedAt: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const groupedTargets = new Map<UnderstandingLinkTargetType, Set<string>>();
  for (const link of evidenceLinks) {
    const safeTargetId = toNonEmptyPublicId(link.targetId);
    if (!safeTargetId) {
      continue;
    }
    const bucket = groupedTargets.get(link.targetType) ?? new Set<string>();
    bucket.add(safeTargetId);
    groupedTargets.set(link.targetType, bucket);
  }

  const usermapIds = [...(groupedTargets.get(UnderstandingLinkTargetType.usermap_conclusion) ?? [])];
  const investigationIds = [...(groupedTargets.get(UnderstandingLinkTargetType.investigation) ?? [])];
  const fieldworkIds = [...(groupedTargets.get(UnderstandingLinkTargetType.fieldwork_assignment) ?? [])];
  const modelUpdateIds = [...(groupedTargets.get(UnderstandingLinkTargetType.model_update) ?? [])];

  const [usermapRows, investigationRows, fieldworkRows, modelUpdateRows] =
    await Promise.all([
      usermapIds.length > 0
        ? prismadb.userMapConclusion.findMany({
            where: {
              userId: args.userId,
              id: { in: usermapIds },
              visibility: UserMapConclusionVisibility.internal_only,
              candidateLifecycleStatus: { in: REVIEW_CANDIDATE_LIFECYCLE_STATUSES },
            },
            select: {
              id: true,
              title: true,
              summary: true,
              area: true,
              confidenceLevel: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      investigationIds.length > 0
        ? prismadb.investigation.findMany({
            where: {
              userId: args.userId,
              id: { in: investigationIds },
              visibility: InvestigationVisibility.internal_only,
              candidateLifecycleStatus: { in: REVIEW_CANDIDATE_LIFECYCLE_STATUSES },
            },
            select: {
              id: true,
              title: true,
              organizingQuestion: true,
              status: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      fieldworkIds.length > 0
        ? prismadb.fieldworkAssignment.findMany({
            where: {
              userId: args.userId,
              id: { in: fieldworkIds },
              visibility: FieldworkAssignmentVisibility.internal_only,
              candidateLifecycleStatus: { in: REVIEW_CANDIDATE_LIFECYCLE_STATUSES },
            },
            select: {
              id: true,
              prompt: true,
              reason: true,
              status: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      modelUpdateIds.length > 0
        ? prismadb.modelUpdate.findMany({
            where: {
              userId: args.userId,
              id: { in: modelUpdateIds },
              visibility: ModelUpdateVisibility.internal_only,
              isMeaningful: false,
            },
            select: {
              id: true,
              updateType: true,
              userFacingSummary: true,
              affectedObjectType: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const items: ExploreConversationReviewItem[] = [];

  for (const row of referenceRows) {
    const kind = referenceKindForType(row.type);
    items.push({
      id: `reference:${row.id}`,
      kind,
      kindLabel: EXPLORE_REVIEW_KIND_LABELS[kind],
      title: clampText(row.statement, TITLE_MAX),
      summary: "A draft receipt or context note from this conversation.",
      sourceLabel: referenceSourceLabel(row.type),
      confidenceLabel: confidenceLabelFromReference(row.confidence),
      status: "needs_review",
      statusLabel: "Needs review",
      selectableObject: null,
      referenceAction: { referenceId: row.id },
      actions: referenceReviewActions(),
    });
  }

  for (const row of usermapRows) {
    if (!row.candidateLifecycleStatus) {
      continue;
    }
    const lifecycle = reviewStatusFromLifecycle(row.candidateLifecycleStatus);
    items.push({
      id: `usermap:${row.id}`,
      kind: "context_profile_update",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.context_profile_update,
      title: clampText(row.title, TITLE_MAX),
      summary: clampText(row.summary, SUMMARY_MAX),
      sourceLabel: formatUserMapArea(row.area),
      confidenceLabel: formatUserMapConfidenceLevel(row.confidenceLevel),
      status: lifecycle.status,
      statusLabel: lifecycle.statusLabel,
      linkedObjectLabel: "Map draft",
      linkedObjectHref: null,
      selectableObject: null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  for (const row of investigationRows) {
    if (!row.candidateLifecycleStatus) {
      continue;
    }
    const lifecycle = reviewStatusFromLifecycle(row.candidateLifecycleStatus);
    items.push({
      id: `investigation:${row.id}`,
      kind: "active_question_proposed",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.active_question_proposed,
      title: clampText(row.title, TITLE_MAX),
      summary: clampText(row.organizingQuestion, SUMMARY_MAX),
      sourceLabel: "Investigation draft",
      linkedObjectLabel: formatInvestigationStatus(row.status),
      linkedObjectHref: null,
      status: lifecycle.status,
      statusLabel: lifecycle.statusLabel,
      selectableObject: null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  for (const row of fieldworkRows) {
    if (!row.candidateLifecycleStatus) {
      continue;
    }
    const lifecycle = reviewStatusFromLifecycle(row.candidateLifecycleStatus);
    items.push({
      id: `fieldwork:${row.id}`,
      kind: "fieldwork_suggestion",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.fieldwork_suggestion,
      title: clampText(row.prompt, TITLE_MAX),
      summary: clampText(row.reason, SUMMARY_MAX),
      sourceLabel: "Fieldwork draft",
      linkedObjectLabel: formatFieldworkStatus(row.status),
      linkedObjectHref: null,
      status: lifecycle.status,
      statusLabel: lifecycle.statusLabel,
      selectableObject: null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  for (const row of modelUpdateRows) {
    items.push({
      id: `model-update:${row.id}`,
      kind: "model_update_candidate",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.model_update_candidate,
      title: `${formatModelUpdateType(row.updateType)} · ${formatPublicObjectLinkTypeLabel(row.affectedObjectType)}`,
      summary: clampText(row.userFacingSummary, SUMMARY_MAX),
      sourceLabel: "Draft model change",
      status: "draft",
      statusLabel: "Draft · not published",
      linkedObjectLabel: "Not on your Map yet",
      linkedObjectHref: null,
      selectableObject: null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  const seenPatternIds = new Set<string>();
  for (const row of patternEvidenceRows) {
    const claim = row.claim;
    if (!claim || seenPatternIds.has(claim.id)) {
      continue;
    }
    seenPatternIds.add(claim.id);
    items.push({
      id: `pattern:${claim.id}`,
      kind: "pattern_signal",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.pattern_signal,
      title: clampText(claim.summary, TITLE_MAX),
      summary: "Early pattern signal from this conversation. Not added to your Map yet.",
      sourceLabel: "Pattern draft",
      confidenceLabel: `${claim.strengthLevel.charAt(0).toUpperCase()}${claim.strengthLevel.slice(1)} strength`,
      status: "draft",
      statusLabel: "Draft",
      linkedObjectHref: null,
      selectableObject: null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  for (const row of contradictionRows) {
    const safeId = toNonEmptyPublicId(row.id);
    if (!safeId) {
      continue;
    }
    const href = buildPublicObjectHref({
      type: "contradiction_node",
      id: safeId,
    });
    const summary = [row.sideA, row.sideB].filter(Boolean).join(" · ");
    items.push({
      id: `contradiction:${safeId}`,
      kind: "contradiction_signal",
      kindLabel: EXPLORE_REVIEW_KIND_LABELS.contradiction_signal,
      title: clampText(row.title, TITLE_MAX),
      summary: clampText(summary || row.title, SUMMARY_MAX),
      sourceLabel: "Tension surfaced in conversation",
      linkedObjectLabel: row.status.replace(/_/g, " "),
      linkedObjectHref: href,
      status: "needs_review",
      statusLabel: "Needs review",
      selectableObject: href
        ? {
            objectType: "contradiction_node",
            objectId: safeId,
            title: row.title,
          }
        : null,
      referenceAction: null,
      actions: readOnlyActions(),
    });
  }

  const deduped = new Map<string, ExploreConversationReviewItem>();
  for (const item of items) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  return [...deduped.values()].slice(0, limit);
}
