import { auth } from "@clerk/nextjs/server";
import { InvestigationSeedType, InvestigationStatus } from "@prisma/client";
import { z } from "zod";

import {
  INTERNAL_INVESTIGATION_REVIEW_DEFAULT_LIMIT as DEFAULT_LIMIT,
  INTERNAL_INVESTIGATION_REVIEW_MAX_LIMIT as MAX_LIMIT,
  listInternalInvestigationReviewCandidates,
} from "../../../../../lib/internal-investigation-review-candidates";
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
  const seedTypeParam = searchParams.get("seedType");

  const status = statusParam
    ? z.nativeEnum(InvestigationStatus).safeParse(statusParam)
    : null;
  const seedType = seedTypeParam
    ? z.nativeEnum(InvestigationSeedType).safeParse(seedTypeParam)
    : null;

  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }
  if (seedType && !seedType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "seedType", message: "Invalid seedType" },
    ]);
  }

  try {
    const items = await listInternalInvestigationReviewCandidates({
      userId,
      limit,
      ...(status?.success ? { status: status.data } : {}),
      ...(seedType?.success ? { seedType: seedType.data } : {}),
    });

    return Response.json({ items });
  } catch (error) {
    console.error("[INTERNAL_INVESTIGATION_REVIEW_CANDIDATES_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
