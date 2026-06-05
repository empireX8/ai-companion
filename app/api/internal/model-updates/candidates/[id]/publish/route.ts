import { auth } from "@clerk/nextjs/server";

import { isInternalUserMapReviewer } from "../../../../../../../lib/internal-review-auth";
import {
  PublishModelUpdateCandidateError,
  publishModelUpdateCandidate,
} from "../../../../../../../lib/model-update-candidate-publish-helper";
import { errorResponse } from "../../../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
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

  if (!id || id.trim().length === 0) {
    return errorResponse(400, "Invalid model update id", "INVALID_ID");
  }

  try {
    const result = await publishModelUpdateCandidate(userId, id);

    return Response.json({
      id: result.id,
      previousVisibility: result.previousVisibility,
      newVisibility: result.newVisibility,
      previousIsMeaningful: result.previousIsMeaningful,
      newIsMeaningful: result.newIsMeaningful,
    });
  } catch (error) {
    if (error instanceof PublishModelUpdateCandidateError) {
      if (error.code === "MODEL_UPDATE_NOT_FOUND") {
        return errorResponse(404, error.message, error.code);
      }
      if (
        error.code === "ALREADY_VISIBLE" ||
        error.code === "ALREADY_MEANINGFUL" ||
        error.code === "MODEL_UPDATE_MISSING_EVIDENCE"
      ) {
        return errorResponse(422, error.message, error.code);
      }
    }

    console.error("[INTERNAL_MODEL_UPDATE_CANDIDATE_PUBLISH_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
