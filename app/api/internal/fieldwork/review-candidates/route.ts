import { auth } from "@clerk/nextjs/server";
import { FieldworkStatus } from "@prisma/client";
import { z } from "zod";

import {
  INTERNAL_FIELDWORK_REVIEW_DEFAULT_LIMIT as DEFAULT_LIMIT,
  INTERNAL_FIELDWORK_REVIEW_MAX_LIMIT as MAX_LIMIT,
  listInternalFieldworkReviewCandidates,
} from "../../../../../lib/internal-fieldwork-review-candidates";
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

  const statusParam = searchParams.get("status");
  const status = statusParam
    ? z.nativeEnum(FieldworkStatus).safeParse(statusParam)
    : null;

  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }

  try {
    const items = await listInternalFieldworkReviewCandidates({
      userId,
      limit,
      ...(status?.success ? { status: status.data } : {}),
    });

    return Response.json({ items });
  } catch (error) {
    console.error("[INTERNAL_FIELDWORK_REVIEW_CANDIDATES_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
