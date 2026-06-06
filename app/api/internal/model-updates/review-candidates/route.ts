import { auth } from "@clerk/nextjs/server";
import { ModelUpdateType } from "@prisma/client";
import { z } from "zod";

import {
  INTERNAL_MODEL_UPDATE_REVIEW_DEFAULT_LIMIT as DEFAULT_LIMIT,
  INTERNAL_MODEL_UPDATE_REVIEW_MAX_LIMIT as MAX_LIMIT,
  listInternalModelUpdateReviewCandidates,
} from "../../../../../lib/internal-model-update-review-candidates";
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

  const updateTypeParam = searchParams.get("updateType");
  const updateType = updateTypeParam
    ? z.nativeEnum(ModelUpdateType).safeParse(updateTypeParam)
    : null;

  if (updateType && !updateType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "updateType", message: "Invalid updateType" },
    ]);
  }

  try {
    const items = await listInternalModelUpdateReviewCandidates({
      userId,
      limit,
      ...(updateType?.success ? { updateType: updateType.data } : {}),
    });

    return Response.json({ items });
  } catch (error) {
    console.error("[INTERNAL_MODEL_UPDATE_REVIEW_CANDIDATES_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
