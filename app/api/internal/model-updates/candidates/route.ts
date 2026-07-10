import { auth } from "@clerk/nextjs/server";

import {
  createInternalModelUpdateCandidateFromOperator,
  internalModelUpdateCandidateCreateBodySchema,
} from "../../../../../lib/internal-model-update-candidate-create";
import { isInternalUserMapReviewer } from "../../../../../lib/internal-review-auth";
import { errorResponse } from "../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  if (!isInternalUserMapReviewer(userId)) {
    return errorResponse(403, "Forbidden", "FORBIDDEN");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body", "INVALID_JSON");
  }

  const parsed = internalModelUpdateCandidateCreateBodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      ...parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    ]);
  }

  try {
    const result = await createInternalModelUpdateCandidateFromOperator({
      userId,
      body: parsed.data,
    });

    return Response.json({
      id: result.persistence.persistedModelUpdateId,
      runId: result.persistence.runId,
      candidatesWritten: result.persistence.payload.candidatesWritten,
      blockedWriteReasons: result.persistence.payload.blockedWriteReasons,
      notes: result.persistence.payload.notes,
      evidenceDepthAuthoringProvided: result.evidenceDepthAuthoringProvided,
      evidenceDepthAuthoringReady: result.evidenceDepthAuthoringReady,
      evidenceDepthAuthoringBlockers: result.evidenceDepthAuthoringBlockers,
      evidenceDepthAuthoringSkippedReason: result.evidenceDepthAuthoringSkippedReason,
    });
  } catch (error) {
    console.error("[INTERNAL_MODEL_UPDATE_CANDIDATE_CREATE_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
