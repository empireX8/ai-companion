import { createHash } from "crypto";
import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  InvestigationVisibility,
  ModelUpdateVisibility,
  Prisma,
  ReferenceStatus,
  SessionOrigin,
  SessionSurfaceType,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type FieldworkAssignment,
  type Investigation,
  type ModelUpdate,
  type PrismaClient,
  type ReferenceItem,
  type UserMapConclusion,
} from "@prisma/client";

import prismadb from "./prismadb";
import {
  buildPublicObjectHref,
  formatPublicObjectLinkTypeLabel,
  toNonEmptyPublicId,
} from "./public-continuity-registry";
import {
  formatFieldworkStatus,
  formatInvestigationSeedType,
  formatModelUpdateType,
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
} from "./public-intelligence-safe-slice";
import type {
  ExploreConversationReviewItem,
  ExploreConversationReviewStatus,
} from "./explore-conversation-review-types";

export const EXPLORE_CONVERSATION_REVIEW_LIMIT = 8;

export const EXPLORE_CONVERSATION_REVIEW_FORBIDDEN_RESPONSE_FIELDS = [
  "candidateLifecycleStatus",
  "visibility",
  "internalNotes",
  "payload",
  "evidencePacket",
  "processorVersion",
  "evaluation",
  "diagnostics",
  "sourceRunId",
  "userId",
] as const;

const DRAFT_ACTIONS = {
  canConfirm: false,
  canEdit: false,
  canReject: false,
} as const;

const REVIEW_LINK_TARGET_TYPES = [
  UnderstandingLinkTargetType.usermap_conclusion,
  UnderstandingLinkTargetType.investigation,
  UnderstandingLinkTargetType.fieldwork_assignment,
  UnderstandingLinkTargetType.model_update,
] as const;

type ReviewLinkTargetType = (typeof REVIEW_LINK_TARGET_TYPES)[number];

type UserMapCandidateRecord = Pick<
  UserMapConclusion,
  | "id"
  | "title"
  | "summary"
  | "area"
  | "status"
  | "confidenceLevel"
  | "candidateLifecycleStatus"
  | "updatedAt"
>;

type InvestigationCandidateRecord = Pick<
  Investigation,
  | "id"
  | "title"
  | "organizingQuestion"
  | "status"
  | "seedType"
  | "candidateLifecycleStatus"
  | "updatedAt"
>;

type FieldworkCandidateRecord = Pick<
  FieldworkAssignment,
  | "id"
  | "prompt"
  | "reason"
  | "status"
  | "linkedObjectType"
  | "linkedObjectId"
  | "candidateLifecycleStatus"
  | "updatedAt"
>;

type ModelUpdateCandidateRecord = Pick<
  ModelUpdate,
  | "id"
  | "updateType"
  | "affectedObjectType"
  | "affectedObjectId"
  | "userFacingSummary"
  | "createdAt"
>;

type ReferenceCandidateRecord = Pick<
  ReferenceItem,
  "id" | "type" | "statement" | "confidence" | "updatedAt"
>;

type ReviewItemWithSort = ExploreConversationReviewItem & {
  sortAt: number;
};

type TargetIdBuckets = Record<ReviewLinkTargetType, Set<string>>;

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function compactText(value: string, maxLength = 360): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxLength - 1).trim()}…`;
}

function buildReviewItemId(prefix: string, id: string): string {
  const digest = createHash("sha256")
    .update(`explore-review:${prefix}:${id}`)
    .digest("hex")
    .slice(0, 20);

  return `review-${prefix}-${digest}`;
}

function isReviewLinkTargetType(value: string): value is ReviewLinkTargetType {
  return REVIEW_LINK_TARGET_TYPES.includes(value as ReviewLinkTargetType);
}

function createTargetIdBuckets(): TargetIdBuckets {
  return {
    [UnderstandingLinkTargetType.usermap_conclusion]: new Set<string>(),
    [UnderstandingLinkTargetType.investigation]: new Set<string>(),
    [UnderstandingLinkTargetType.fieldwork_assignment]: new Set<string>(),
    [UnderstandingLinkTargetType.model_update]: new Set<string>(),
  };
}

function mapLifecycleStatusToReviewStatus(
  status: CandidateLifecycleStatus | null | undefined
): ExploreConversationReviewStatus {
  if (status === CandidateLifecycleStatus.rejected) {
    return "rejected";
  }

  if (status === CandidateLifecycleStatus.held_for_more_evidence) {
    return "deferred";
  }

  if (status === CandidateLifecycleStatus.promoted) {
    return "confirmed";
  }

  return "needs_review";
}

function buildSafeLinkedObjectHref(input: {
  type: UnderstandingLinkTargetType;
  id: string | null | undefined;
}): string | undefined {
  const safeId = toNonEmptyPublicId(input.id);
  if (!safeId) {
    return undefined;
  }

  // Draft review cards should not deep-link to internal-only UserMap,
  // Investigation, Fieldwork, or ModelUpdate rows. Existing public pattern and
  // contradiction objects are safe as contextual links.
  if (
    input.type !== UnderstandingLinkTargetType.pattern_claim &&
    input.type !== UnderstandingLinkTargetType.contradiction_node
  ) {
    return undefined;
  }

  return buildPublicObjectHref({ type: input.type, id: safeId }) ?? undefined;
}

export function projectUserMapCandidateToExploreReviewItem(
  row: UserMapCandidateRecord
): ReviewItemWithSort {
  return {
    id: buildReviewItemId("usermap", row.id),
    kind: "context_profile_update",
    title: compactText(row.title, 120),
    summary: compactText(row.summary),
    sourceLabel: `Draft map item · ${formatUserMapArea(row.area)}`,
    confidenceLabel: `${formatUserMapConfidenceLevel(row.confidenceLevel)} confidence`,
    status: mapLifecycleStatusToReviewStatus(row.candidateLifecycleStatus),
    selectableObject: null,
    actions: DRAFT_ACTIONS,
    sortAt: row.updatedAt.getTime(),
  };
}

export function projectInvestigationCandidateToExploreReviewItem(
  row: InvestigationCandidateRecord
): ReviewItemWithSort {
  return {
    id: buildReviewItemId("investigation", row.id),
    kind: "active_question_proposed",
    title: compactText(row.title, 120),
    summary: compactText(row.organizingQuestion),
    sourceLabel: `Draft active question · ${formatInvestigationSeedType(row.seedType)}`,
    confidenceLabel: formatInvestigationStatusForReview(row.status),
    status: mapLifecycleStatusToReviewStatus(row.candidateLifecycleStatus),
    selectableObject: null,
    actions: DRAFT_ACTIONS,
    sortAt: row.updatedAt.getTime(),
  };
}

function formatInvestigationStatusForReview(status: Investigation["status"]): string {
  return `${toTitleCase(status)} state`;
}

export function projectFieldworkCandidateToExploreReviewItem(
  row: FieldworkCandidateRecord
): ReviewItemWithSort {
  return {
    id: buildReviewItemId("fieldwork", row.id),
    kind: "fieldwork_suggestion",
    title: compactText(row.prompt, 120),
    summary: compactText(row.reason),
    sourceLabel: `Draft watch-for · ${formatFieldworkStatus(row.status)}`,
    linkedObjectLabel: formatPublicObjectLinkTypeLabel(row.linkedObjectType),
    linkedObjectHref: buildSafeLinkedObjectHref({
      type: row.linkedObjectType,
      id: row.linkedObjectId,
    }),
    status: mapLifecycleStatusToReviewStatus(row.candidateLifecycleStatus),
    selectableObject: null,
    actions: DRAFT_ACTIONS,
    sortAt: row.updatedAt.getTime(),
  };
}

export function projectModelUpdateCandidateToExploreReviewItem(
  row: ModelUpdateCandidateRecord
): ReviewItemWithSort {
  return {
    id: buildReviewItemId("model-update", row.id),
    kind: "model_update_candidate",
    title: formatModelUpdateType(row.updateType),
    summary: compactText(row.userFacingSummary),
    sourceLabel: "Draft possible movement",
    linkedObjectLabel: formatPublicObjectLinkTypeLabel(row.affectedObjectType),
    linkedObjectHref: buildSafeLinkedObjectHref({
      type: row.affectedObjectType,
      id: row.affectedObjectId,
    }),
    status: "needs_review",
    selectableObject: null,
    actions: DRAFT_ACTIONS,
    sortAt: row.createdAt.getTime(),
  };
}

export function projectReferenceCandidateToExploreReviewItem(
  row: ReferenceCandidateRecord
): ReviewItemWithSort {
  return {
    id: buildReviewItemId("reference", row.id),
    kind: "context_profile_update",
    title: `${toTitleCase(row.type)} candidate`,
    summary: compactText(row.statement),
    sourceLabel: "Draft context/profile update",
    confidenceLabel: `${toTitleCase(row.confidence)} confidence`,
    status: "needs_review",
    selectableObject: null,
    actions: DRAFT_ACTIONS,
    sortAt: row.updatedAt.getTime(),
  };
}

function stripSortField(item: ReviewItemWithSort): ExploreConversationReviewItem {
  const { sortAt: _sortAt, ...publicItem } = item;
  return publicItem;
}

function collectTargetIds(
  rows: Array<{ targetType: UnderstandingLinkTargetType; targetId: string }>
): TargetIdBuckets {
  const buckets = createTargetIdBuckets();

  for (const row of rows) {
    if (!isReviewLinkTargetType(row.targetType)) {
      continue;
    }

    const safeId = toNonEmptyPublicId(row.targetId);
    if (!safeId) {
      continue;
    }

    buckets[row.targetType].add(safeId);
  }

  return buckets;
}

function toIdArray(ids: Set<string>): string[] {
  return [...ids].filter((id) => id.trim().length > 0);
}

export type GetExploreConversationReviewItemsResult = {
  sessionFound: boolean;
  sourceAvailable: boolean;
  items: ExploreConversationReviewItem[];
};

export async function getExploreConversationReviewItems(args: {
  userId: string;
  sessionId: string;
  limit?: number;
  db?: PrismaClient;
}): Promise<GetExploreConversationReviewItemsResult> {
  const db = args.db ?? prismadb;
  const limit = Math.min(
    EXPLORE_CONVERSATION_REVIEW_LIMIT,
    Math.max(1, Math.floor(args.limit ?? EXPLORE_CONVERSATION_REVIEW_LIMIT))
  );

  const session = await db.session.findFirst({
    where: {
      id: args.sessionId,
      userId: args.userId,
      origin: SessionOrigin.APP,
      surfaceType: SessionSurfaceType.explore_chat,
    },
    select: { id: true },
  });

  if (!session) {
    return { sessionFound: false, sourceAvailable: true, items: [] };
  }

  const messages = await db.message.findMany({
    where: {
      userId: args.userId,
      sessionId: args.sessionId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { id: true },
  });
  const messageIds = messages.map((message) => message.id);

  const [patternEvidenceRows, contradictionEvidenceRows, referenceRows] =
    await Promise.all([
      db.patternClaimEvidence.findMany({
        where: { sessionId: args.sessionId },
        select: { id: true },
        take: 100,
      }),
      db.contradictionEvidence.findMany({
        where: { sessionId: args.sessionId },
        select: { id: true },
        take: 100,
      }),
      db.referenceItem.findMany({
        where: {
          userId: args.userId,
          status: ReferenceStatus.candidate,
          sourceSessionId: args.sessionId,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          statement: true,
          confidence: true,
          updatedAt: true,
        },
      }),
    ]);

  const sourceFilters: Prisma.UnderstandingEvidenceLinkWhereInput[] = [
    {
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.sessionId,
    },
  ];

  if (messageIds.length > 0) {
    sourceFilters.push({
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: { in: messageIds },
    });
  }

  const patternEvidenceIds = patternEvidenceRows.map((row) => row.id);
  if (patternEvidenceIds.length > 0) {
    sourceFilters.push({
      sourceType: UnderstandingLinkSourceType.pattern_claim_evidence,
      sourceId: { in: patternEvidenceIds },
    });
  }

  const contradictionEvidenceIds = contradictionEvidenceRows.map((row) => row.id);
  if (contradictionEvidenceIds.length > 0) {
    sourceFilters.push({
      sourceType: UnderstandingLinkSourceType.contradiction_evidence,
      sourceId: { in: contradictionEvidenceIds },
    });
  }

  const linkRows = await db.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: { in: [...REVIEW_LINK_TARGET_TYPES] },
      OR: sourceFilters,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      targetType: true,
      targetId: true,
    },
  });

  const buckets = collectTargetIds(linkRows);
  const userMapIds = toIdArray(buckets[UnderstandingLinkTargetType.usermap_conclusion]);
  const investigationIds = toIdArray(buckets[UnderstandingLinkTargetType.investigation]);
  const fieldworkIds = toIdArray(buckets[UnderstandingLinkTargetType.fieldwork_assignment]);
  const modelUpdateIds = toIdArray(buckets[UnderstandingLinkTargetType.model_update]);

  const [userMapRows, investigationRows, fieldworkRows, modelUpdateRows] =
    await Promise.all([
      userMapIds.length > 0
        ? db.userMapConclusion.findMany({
            where: {
              id: { in: userMapIds },
              userId: args.userId,
              visibility: "internal_only",
              candidateLifecycleStatus: {
                in: [
                  CandidateLifecycleStatus.proposed,
                  CandidateLifecycleStatus.held_for_more_evidence,
                ],
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              title: true,
              summary: true,
              area: true,
              status: true,
              confidenceLevel: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      investigationIds.length > 0
        ? db.investigation.findMany({
            where: {
              id: { in: investigationIds },
              userId: args.userId,
              visibility: InvestigationVisibility.internal_only,
              candidateLifecycleStatus: {
                in: [
                  CandidateLifecycleStatus.proposed,
                  CandidateLifecycleStatus.held_for_more_evidence,
                ],
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              title: true,
              organizingQuestion: true,
              status: true,
              seedType: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      fieldworkIds.length > 0
        ? db.fieldworkAssignment.findMany({
            where: {
              id: { in: fieldworkIds },
              userId: args.userId,
              visibility: FieldworkAssignmentVisibility.internal_only,
              candidateLifecycleStatus: {
                in: [
                  CandidateLifecycleStatus.proposed,
                  CandidateLifecycleStatus.held_for_more_evidence,
                ],
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              prompt: true,
              reason: true,
              status: true,
              linkedObjectType: true,
              linkedObjectId: true,
              candidateLifecycleStatus: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      modelUpdateIds.length > 0
        ? db.modelUpdate.findMany({
            where: {
              id: { in: modelUpdateIds },
              userId: args.userId,
              visibility: {
                in: [ModelUpdateVisibility.internal_only, ModelUpdateVisibility.candidate],
              },
              isMeaningful: false,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              updateType: true,
              affectedObjectType: true,
              affectedObjectId: true,
              userFacingSummary: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const items = [
    ...referenceRows.map(projectReferenceCandidateToExploreReviewItem),
    ...userMapRows.map(projectUserMapCandidateToExploreReviewItem),
    ...investigationRows.map(projectInvestigationCandidateToExploreReviewItem),
    ...fieldworkRows.map(projectFieldworkCandidateToExploreReviewItem),
    ...modelUpdateRows.map(projectModelUpdateCandidateToExploreReviewItem),
  ]
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, limit)
    .map(stripSortField);

  return {
    sessionFound: true,
    sourceAvailable: true,
    items,
  };
}
