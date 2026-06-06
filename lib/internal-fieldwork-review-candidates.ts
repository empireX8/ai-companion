import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  FieldworkStatus,
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT,
  readSafetyLevelFromMeta,
  type InternalUserMapReviewLinkedSource,
} from "./internal-user-map-review-candidates";
import prismadb from "./prismadb";

export {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT as INTERNAL_FIELDWORK_REVIEW_DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT as INTERNAL_FIELDWORK_REVIEW_MAX_LIMIT,
};

export type InternalFieldworkReviewCandidate = {
  id: string;
  prompt: string;
  reason: string;
  status: FieldworkStatus;
  visibility: FieldworkAssignmentVisibility;
  candidateLifecycleStatus: CandidateLifecycleStatus;
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: {
    linkCount: number;
    sourceTypes: Record<string, number>;
    safetyLevels: Record<string, number>;
    linkedSources: InternalUserMapReviewLinkedSource[];
  };
  diagnostics: {
    latestRunId: string | null;
    latestArtifactId: string | null;
    latestArtifactType: string | null;
    processorVersion: string | null;
    blockedWriteReasons: string[];
    warnings: string[];
  };
};

export type InternalFieldworkReviewCandidatesQuery = {
  userId: string;
  limit: number;
  status?: FieldworkStatus;
};

type DbLike = typeof prismadb;

type EvidenceAggregate = {
  linkCount: number;
  sourceTypes: Partial<Record<UnderstandingLinkSourceType, number>>;
  safetyLevels: Record<string, number>;
  linkedSources: InternalUserMapReviewLinkedSource[];
};

const EMPTY_EVIDENCE: EvidenceAggregate = {
  linkCount: 0,
  sourceTypes: {},
  safetyLevels: {},
  linkedSources: [],
};

const EMPTY_DIAGNOSTICS: InternalFieldworkReviewCandidate["diagnostics"] = {
  latestRunId: null,
  latestArtifactId: null,
  latestArtifactType: null,
  processorVersion: null,
  blockedWriteReasons: [],
  warnings: [],
};

function recordSafetyLevel(
  safetyLevels: Record<string, number>,
  safetyLevel: string | null
): void {
  if (!safetyLevel) {
    return;
  }

  safetyLevels[safetyLevel] = (safetyLevels[safetyLevel] ?? 0) + 1;
}

export async function listInternalFieldworkReviewCandidates(
  query: InternalFieldworkReviewCandidatesQuery,
  db: DbLike = prismadb
): Promise<InternalFieldworkReviewCandidate[]> {
  const candidates = await db.fieldworkAssignment.findMany({
    where: {
      userId: query.userId,
      visibility: FieldworkAssignmentVisibility.internal_only,
      candidateLifecycleStatus: { not: null },
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit,
    select: {
      id: true,
      prompt: true,
      reason: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      linkedObjectType: true,
      linkedObjectId: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const candidateIds = candidates.map((candidate) => candidate.id);
  const evidenceLinks =
    candidateIds.length > 0
      ? await db.understandingEvidenceLink.findMany({
          where: {
            userId: query.userId,
            targetType: UnderstandingLinkTargetType.fieldwork_assignment,
            targetId: { in: candidateIds },
          },
          select: {
            targetId: true,
            sourceType: true,
            sourceId: true,
            meta: true,
          },
        })
      : [];

  const evidenceByTarget = new Map<string, EvidenceAggregate>();

  for (const link of evidenceLinks) {
    const existing = evidenceByTarget.get(link.targetId) ?? {
      linkCount: 0,
      sourceTypes: {},
      safetyLevels: {},
      linkedSources: [],
    };

    const safetyLevel = readSafetyLevelFromMeta(link.meta);

    existing.linkCount += 1;
    existing.sourceTypes[link.sourceType] =
      (existing.sourceTypes[link.sourceType] ?? 0) + 1;
    recordSafetyLevel(existing.safetyLevels, safetyLevel);
    existing.linkedSources.push({
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      safetyLevel,
    });
    evidenceByTarget.set(link.targetId, existing);
  }

  return candidates.flatMap((candidate) => {
    // Defense-in-depth: query filters null lifecycle, but skip if a row slips through.
    if (candidate.candidateLifecycleStatus === null) {
      return [];
    }

    const evidence = evidenceByTarget.get(candidate.id) ?? EMPTY_EVIDENCE;

    return [
      {
        id: candidate.id,
        prompt: candidate.prompt,
        reason: candidate.reason,
        status: candidate.status,
        visibility: candidate.visibility,
        candidateLifecycleStatus: candidate.candidateLifecycleStatus,
        linkedObjectType: candidate.linkedObjectType,
        linkedObjectId: candidate.linkedObjectId,
        expiresAt: candidate.expiresAt?.toISOString() ?? null,
        createdAt: candidate.createdAt.toISOString(),
        updatedAt: candidate.updatedAt.toISOString(),
        evidence: {
          linkCount: evidence.linkCount,
          sourceTypes: evidence.sourceTypes,
          safetyLevels: evidence.safetyLevels,
          linkedSources: evidence.linkedSources,
        },
        diagnostics: EMPTY_DIAGNOSTICS,
      },
    ];
  });
}
