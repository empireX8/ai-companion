import {
  CandidateLifecycleStatus,
  InvestigationSeedType,
  InvestigationStatus,
  InvestigationVisibility,
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
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT as INTERNAL_INVESTIGATION_REVIEW_DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT as INTERNAL_INVESTIGATION_REVIEW_MAX_LIMIT,
};

export type InternalInvestigationReviewCandidate = {
  id: string;
  title: string;
  organizingQuestion: string;
  summary: string;
  status: InvestigationStatus;
  seedType: InvestigationSeedType;
  visibility: InvestigationVisibility;
  candidateLifecycleStatus: CandidateLifecycleStatus;
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

export type InternalInvestigationReviewCandidatesQuery = {
  userId: string;
  limit: number;
  status?: InvestigationStatus;
  seedType?: InvestigationSeedType;
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

const EMPTY_DIAGNOSTICS: InternalInvestigationReviewCandidate["diagnostics"] = {
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

export function resolveInvestigationReviewSummary(
  evidenceNeeded: unknown,
  organizingQuestion: string
): string {
  if (Array.isArray(evidenceNeeded)) {
    for (const entry of evidenceNeeded) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }

  return organizingQuestion;
}

export async function listInternalInvestigationReviewCandidates(
  query: InternalInvestigationReviewCandidatesQuery,
  db: DbLike = prismadb
): Promise<InternalInvestigationReviewCandidate[]> {
  const candidates = await db.investigation.findMany({
    where: {
      userId: query.userId,
      visibility: InvestigationVisibility.internal_only,
      candidateLifecycleStatus: { not: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.seedType ? { seedType: query.seedType } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit,
    select: {
      id: true,
      title: true,
      organizingQuestion: true,
      evidenceNeeded: true,
      status: true,
      seedType: true,
      visibility: true,
      candidateLifecycleStatus: true,
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
            targetType: UnderstandingLinkTargetType.investigation,
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
    if (candidate.candidateLifecycleStatus === null) {
      return [];
    }

    const evidence = evidenceByTarget.get(candidate.id) ?? EMPTY_EVIDENCE;

    return [
      {
        id: candidate.id,
        title: candidate.title,
        organizingQuestion: candidate.organizingQuestion,
        summary: resolveInvestigationReviewSummary(
          candidate.evidenceNeeded,
          candidate.organizingQuestion
        ),
        status: candidate.status,
        seedType: candidate.seedType,
        visibility: candidate.visibility,
        candidateLifecycleStatus: candidate.candidateLifecycleStatus,
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
