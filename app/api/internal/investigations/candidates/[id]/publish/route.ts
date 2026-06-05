import { auth } from "@clerk/nextjs/server";

import { isInternalUserMapReviewer } from "../../../../../../../lib/internal-review-auth";
import {
  PublishInvestigationCandidateError,
  publishInvestigationCandidate,
} from "../../../../../../../lib/investigation-publish-helper";
import { errorResponse } from "../../../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  if (!isInternalUserMapReviewer(userId)) {
    return errorResponse(403, "Forbidden", "FORBIDDEN");
  }

  const { id } = await params;

  try {
    const result = await publishInvestigationCandidate(userId, id);

    return Response.json({
      id: result.id,
      previousVisibility: result.previousVisibility,
      newVisibility: result.newVisibility,
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof PublishInvestigationCandidateError) {
      if (
        error.code === "INVESTIGATION_NOT_FOUND" ||
        error.code === "NULL_LIFECYCLE_STATUS"
      ) {
        return errorResponse(404, error.message, error.code);
      }
      if (error.code === "NOT_PROMOTED" || error.code === "ALREADY_VISIBLE") {
        return errorResponse(422, error.message, error.code);
      }
    }

    console.error("[INTERNAL_INVESTIGATION_CANDIDATE_PUBLISH_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
