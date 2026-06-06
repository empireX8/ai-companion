import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import { UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE } from "./derivation-layer";
import {
  extractSafeDiagnosticsFromPayload,
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT,
  readSafetyLevelFromMeta,
  type InternalUserMapReviewLinkedSource,
} from "./internal-user-map-review-candidates";
import prismadb from "./prismadb";

export {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT as INTERNAL_MODEL_UPDATE_REVIEW_DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT as INTERNAL_MODEL_UPDATE_REVIEW_MAX_LIMIT,
};

export type InternalModelUpdateReviewCandidate = {
  id: string;
  updateType: ModelUpdateType;
  userFacingSummary: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string | null;
  afterSummary: string | null;
  confidenceDelta: number | null;
  visibility: ModelUpdateVisibility;
  isMeaningful: boolean;
  sourceRunId: string | null;
  createdAt: string;
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

export type InternalModelUpdateReviewCandidatesQuery = {
  userId: string;
  limit: number;
  updateType?: ModelUpdateType;
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

const EMPTY_DIAGNOSTICS: InternalModelUpdateReviewCandidate["diagnostics"] = {
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

export async function listInternalModelUpdateReviewCandidates(
  query: InternalModelUpdateReviewCandidatesQuery,
  db: DbLike = prismadb
): Promise<InternalModelUpdateReviewCandidate[]> {
  const candidates = await db.modelUpdate.findMany({
    where: {
      userId: query.userId,
      visibility: ModelUpdateVisibility.internal_only,
      isMeaningful: false,
      ...(query.updateType ? { updateType: query.updateType } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit,
    select: {
      id: true,
      updateType: true,
      userFacingSummary: true,
      affectedObjectType: true,
      affectedObjectId: true,
      beforeSummary: true,
      afterSummary: true,
      confidenceDelta: true,
      visibility: true,
      isMeaningful: true,
      sourceRunId: true,
      createdAt: true,
    },
  });

  const candidateIds = candidates.map((candidate) => candidate.id);
  const evidenceLinks =
    candidateIds.length > 0
      ? await db.understandingEvidenceLink.findMany({
          where: {
            userId: query.userId,
            targetType: UnderstandingLinkTargetType.model_update,
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

  const uniqueRunIds = [
    ...new Set(
      candidates
        .map((candidate) => candidate.sourceRunId?.trim() || null)
        .filter((runId): runId is string => Boolean(runId))
    ),
  ];

  const diagnosticsArtifacts =
    uniqueRunIds.length > 0
      ? await db.derivationArtifact.findMany({
          where: {
            userId: query.userId,
            runId: { in: uniqueRunIds },
            type: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            type: true,
            runId: true,
            payload: true,
          },
        })
      : [];

  const artifactByRunId = new Map<
    string,
    (typeof diagnosticsArtifacts)[number]
  >();
  for (const artifact of diagnosticsArtifacts) {
    if (!artifactByRunId.has(artifact.runId)) {
      artifactByRunId.set(artifact.runId, artifact);
    }
  }

  return candidates.flatMap((candidate) => {
    if (candidate.isMeaningful) {
      return [];
    }

    const evidence = evidenceByTarget.get(candidate.id) ?? EMPTY_EVIDENCE;
    const runId = candidate.sourceRunId?.trim() || null;
    const artifact = runId ? artifactByRunId.get(runId) : undefined;
    const safeDiagnostics = artifact
      ? extractSafeDiagnosticsFromPayload(artifact.payload)
      : null;

    const diagnostics: InternalModelUpdateReviewCandidate["diagnostics"] = runId
      ? {
          latestRunId: runId,
          latestArtifactId: artifact?.id ?? null,
          latestArtifactType: artifact?.type ?? null,
          processorVersion: safeDiagnostics?.processorVersion ?? null,
          blockedWriteReasons: safeDiagnostics?.blockedWriteReasons ?? [],
          warnings: safeDiagnostics?.warnings ?? [],
        }
      : EMPTY_DIAGNOSTICS;

    return [
      {
        id: candidate.id,
        updateType: candidate.updateType,
        userFacingSummary: candidate.userFacingSummary,
        affectedObjectType: candidate.affectedObjectType,
        affectedObjectId: candidate.affectedObjectId,
        beforeSummary: candidate.beforeSummary,
        afterSummary: candidate.afterSummary,
        confidenceDelta: candidate.confidenceDelta,
        visibility: candidate.visibility,
        isMeaningful: candidate.isMeaningful,
        sourceRunId: runId,
        createdAt: candidate.createdAt.toISOString(),
        evidence: {
          linkCount: evidence.linkCount,
          sourceTypes: evidence.sourceTypes,
          safetyLevels: evidence.safetyLevels,
          linkedSources: evidence.linkedSources,
        },
        diagnostics,
      },
    ];
  });
}
