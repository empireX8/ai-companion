import {
  UnderstandingLinkTargetType,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";

export const INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT = 50;
export const INTERNAL_USER_MAP_REVIEW_MAX_LIMIT = 100;

export type InternalUserMapReviewCandidate = {
  id: string;
  title: string;
  summary: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  confidenceLevel: UserMapConfidenceLevel;
  visibility: UserMapConclusionVisibility;
  createdAt: string;
  updatedAt: string;
  evidence: {
    linkCount: number;
    sourceTypes: Record<string, number>;
  };
  diagnostics: {
    latestRunId: string | null;
    latestArtifactId: string | null;
    latestArtifactType: string | null;
  };
};

export type InternalUserMapReviewCandidatesQuery = {
  userId: string;
  limit: number;
  area?: UserMapConclusionArea;
  status?: UserMapConclusionStatus;
  confidenceLevel?: UserMapConfidenceLevel;
};

type DbLike = typeof prismadb;

export async function listInternalUserMapReviewCandidates(
  query: InternalUserMapReviewCandidatesQuery,
  db: DbLike = prismadb
): Promise<InternalUserMapReviewCandidate[]> {
  const candidates = await db.userMapConclusion.findMany({
    where: {
      userId: query.userId,
      visibility: UserMapConclusionVisibility.internal_only,
      ...(query.area ? { area: query.area } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.confidenceLevel ? { confidenceLevel: query.confidenceLevel } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit,
    select: {
      id: true,
      title: true,
      summary: true,
      area: true,
      status: true,
      confidenceLevel: true,
      visibility: true,
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
            targetType: UnderstandingLinkTargetType.usermap_conclusion,
            targetId: { in: candidateIds },
          },
          select: {
            targetId: true,
            sourceType: true,
          },
        })
      : [];

  const evidenceByTarget = new Map<
    string,
    {
      linkCount: number;
      sourceTypes: Partial<Record<UnderstandingLinkSourceType, number>>;
    }
  >();

  for (const link of evidenceLinks) {
    const existing = evidenceByTarget.get(link.targetId) ?? {
      linkCount: 0,
      sourceTypes: {},
    };

    existing.linkCount += 1;
    existing.sourceTypes[link.sourceType] = (existing.sourceTypes[link.sourceType] ?? 0) + 1;
    evidenceByTarget.set(link.targetId, existing);
  }

  return candidates.map((candidate) => {
    const evidence = evidenceByTarget.get(candidate.id) ?? {
      linkCount: 0,
      sourceTypes: {},
    };

    return {
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      area: candidate.area,
      status: candidate.status,
      confidenceLevel: candidate.confidenceLevel,
      visibility: candidate.visibility,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      evidence: {
        linkCount: evidence.linkCount,
        sourceTypes: evidence.sourceTypes,
      },
      diagnostics: {
        latestRunId: null,
        latestArtifactId: null,
        latestArtifactType: null,
      },
    };
  });
}
