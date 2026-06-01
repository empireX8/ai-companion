import {
  CandidateLifecycleStatus,
  UnderstandingLinkTargetType,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import { UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE } from "./derivation-layer";
import prismadb from "./prismadb";

export const INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT = 50;
export const INTERNAL_USER_MAP_REVIEW_MAX_LIMIT = 100;

export type InternalUserMapReviewLinkedSource = {
  sourceType: string;
  sourceId: string;
  safetyLevel: string | null;
};

export type InternalUserMapReviewCandidate = {
  id: string;
  title: string;
  summary: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  confidenceLevel: UserMapConfidenceLevel;
  visibility: UserMapConclusionVisibility;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
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

export type InternalUserMapReviewCandidatesQuery = {
  userId: string;
  limit: number;
  area?: UserMapConclusionArea;
  status?: UserMapConclusionStatus;
  confidenceLevel?: UserMapConfidenceLevel;
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

const EMPTY_DIAGNOSTICS: InternalUserMapReviewCandidate["diagnostics"] = {
  latestRunId: null,
  latestArtifactId: null,
  latestArtifactType: null,
  processorVersion: null,
  blockedWriteReasons: [],
  warnings: [],
};

export function parseSourceRunIdFromNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }

  const match = notes.match(/(?:^|;\s*)sourceRun:([^;\s]+)/);
  return match?.[1]?.trim() || null;
}

export function readSafetyLevelFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const level = (meta as Record<string, unknown>).publicSafetyLevel;
  return typeof level === "string" && level.trim().length > 0 ? level : null;
}

function extractSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function extractSafeDiagnosticsFromPayload(payload: unknown): {
  processorVersion: string | null;
  blockedWriteReasons: string[];
  warnings: string[];
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      processorVersion: null,
      blockedWriteReasons: [],
      warnings: [],
    };
  }

  const record = payload as Record<string, unknown>;
  return {
    processorVersion:
      typeof record.processorVersion === "string" ? record.processorVersion : null,
    blockedWriteReasons: extractSafeStringArray(record.blockedWriteReasons),
    warnings: extractSafeStringArray(record.warnings),
  };
}

function recordSafetyLevel(
  safetyLevels: Record<string, number>,
  safetyLevel: string | null
): void {
  if (!safetyLevel) {
    return;
  }

  safetyLevels[safetyLevel] = (safetyLevels[safetyLevel] ?? 0) + 1;
}

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
      candidateLifecycleStatus: true,
      notes: true,
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

  const runIdByCandidateId = new Map<string, string>();
  for (const candidate of candidates) {
    const runId = parseSourceRunIdFromNotes(candidate.notes);
    if (runId) {
      runIdByCandidateId.set(candidate.id, runId);
    }
  }

  const uniqueRunIds = [...new Set(runIdByCandidateId.values())];
  const diagnosticsArtifacts =
    uniqueRunIds.length > 0
      ? await db.derivationArtifact.findMany({
          where: {
            userId: query.userId,
            runId: { in: uniqueRunIds },
            type: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
          },
          select: {
            id: true,
            type: true,
            runId: true,
            payload: true,
          },
        })
      : [];

  const artifactByRunId = new Map(
    diagnosticsArtifacts.map((artifact) => [artifact.runId, artifact])
  );

  return candidates.map((candidate) => {
    const evidence = evidenceByTarget.get(candidate.id) ?? EMPTY_EVIDENCE;
    const runId = runIdByCandidateId.get(candidate.id) ?? null;
    const artifact = runId ? artifactByRunId.get(runId) : undefined;
    const safeDiagnostics = artifact
      ? extractSafeDiagnosticsFromPayload(artifact.payload)
      : null;

    const diagnostics: InternalUserMapReviewCandidate["diagnostics"] = runId
      ? {
          latestRunId: runId,
          latestArtifactId: artifact?.id ?? null,
          latestArtifactType: artifact?.type ?? null,
          processorVersion: safeDiagnostics?.processorVersion ?? null,
          blockedWriteReasons: safeDiagnostics?.blockedWriteReasons ?? [],
          warnings: safeDiagnostics?.warnings ?? [],
        }
      : EMPTY_DIAGNOSTICS;

    return {
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      area: candidate.area,
      status: candidate.status,
      confidenceLevel: candidate.confidenceLevel,
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
      diagnostics,
    };
  });
}
