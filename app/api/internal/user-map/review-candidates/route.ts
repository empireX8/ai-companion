import { auth } from "@clerk/nextjs/server";
import {
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
} from "@prisma/client";
import { z } from "zod";

import {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT as DEFAULT_LIMIT,
  INTERNAL_USER_MAP_REVIEW_MAX_LIMIT as MAX_LIMIT,
  listInternalUserMapReviewCandidates,
} from "../../../../../lib/internal-user-map-review-candidates";
import { isInternalUserMapReviewer } from "../../../../../lib/internal-review-auth";
import { errorResponse } from "../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

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
    const items = await listInternalUserMapReviewCandidates({
      userId,
      limit,
      ...(area?.success ? { area: area.data } : {}),
      ...(status?.success ? { status: status.data } : {}),
      ...(confidenceLevel?.success
        ? { confidenceLevel: confidenceLevel.data }
        : {}),
    });

    return Response.json({ items });
  } catch (error) {
    console.error("[INTERNAL_USER_MAP_REVIEW_CANDIDATES_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
