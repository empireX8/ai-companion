import { auth } from "@clerk/nextjs/server";
import {
  UnderstandingLinkTargetType,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import { isInternalUserMapReviewer } from "../../../../../lib/internal-review-auth";
import { errorResponse } from "../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type CandidateSummary = {
  id: string;
  title: string;
  summary: string;
  area: UserMapConclusionArea;
  status: UserMapConclusionStatus;
  confidenceLevel: UserMapConfidenceLevel;
  visibility: "internal_only";
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

function parseLimit(value: string | null): number | null {
  if (value === null) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return null;
  }

  return parsed;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  if (!isInternalUserMapReviewer(userId)) {
    return errorResponse(403, "Forbidden", "FORBIDDEN");
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  if (limit === null) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "limit", message: `limit must be between 1 and ${MAX_LIMIT}` },
    ]);
  }

  const areaParam = searchParams.get("area");
  const statusParam = searchParams.get("status");
  const confidenceLevelParam = searchParams.get("confidenceLevel");

  const area = areaParam
    ? z.nativeEnum(UserMapConclusionArea).safeParse(areaParam)
    : null;
  const status = statusParam
    ? z.nativeEnum(UserMapConclusionStatus).safeParse(statusParam)
    : null;
  const confidenceLevel = confidenceLevelParam
    ? z.nativeEnum(UserMapConfidenceLevel).safeParse(confidenceLevelParam)
    : null;

  if (area && !area.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "area", message: "Invalid area" },
    ]);
  }
  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }
  if (confidenceLevel && !confidenceLevel.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "confidenceLevel", message: "Invalid confidenceLevel" },
    ]);
  }

  try {
    const candidates = await prismadb.userMapConclusion.findMany({
      where: {
        userId,
        visibility: UserMapConclusionVisibility.internal_only,
        ...(area?.success ? { area: area.data } : {}),
        ...(status?.success ? { status: status.data } : {}),
        ...(confidenceLevel?.success
          ? { confidenceLevel: confidenceLevel.data }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
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
        ? await prismadb.understandingEvidenceLink.findMany({
            where: {
              userId,
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
      { linkCount: number; sourceTypes: Partial<Record<UnderstandingLinkSourceType, number>> }
    >();

    for (const link of evidenceLinks) {
      const existing = evidenceByTarget.get(link.targetId) ?? {
        linkCount: 0,
        sourceTypes: {},
      };

      existing.linkCount += 1;
      existing.sourceTypes[link.sourceType] =
        (existing.sourceTypes[link.sourceType] ?? 0) + 1;
      evidenceByTarget.set(link.targetId, existing);
    }

    const items: CandidateSummary[] = candidates.map((candidate) => {
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
        visibility: UserMapConclusionVisibility.internal_only,
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

    return Response.json({ items });
  } catch (error) {
    console.error("[INTERNAL_USER_MAP_REVIEW_CANDIDATES_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
