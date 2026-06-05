import { auth } from "@clerk/nextjs/server";
import { CandidateLifecycleStatus } from "@prisma/client";
import { z } from "zod";

import { isInternalUserMapReviewer } from "../../../../../../../lib/internal-review-auth";
import {
  FieldworkLifecyclePersistenceError,
  updateFieldworkCandidateLifecycleStatus,
} from "../../../../../../../lib/fieldwork-candidate-lifecycle-persistence";
import { errorResponse } from "../../../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

const lifecycleBodySchema = z.object({
  newStatus: z.nativeEnum(CandidateLifecycleStatus),
});

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "body", message: "Invalid JSON" },
    ]);
  }

  const parsed = lifecycleBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "newStatus", message: "Invalid CandidateLifecycleStatus" },
    ]);
  }

  try {
    const result = await updateFieldworkCandidateLifecycleStatus(
      userId,
      id,
      parsed.data.newStatus
    );

    return Response.json({
      id: result.id,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof FieldworkLifecyclePersistenceError) {
      if (
        error.code === "FIELDWORK_NOT_FOUND" ||
        error.code === "NULL_LIFECYCLE_STATUS"
      ) {
        return errorResponse(404, error.message, error.code);
      }
      if (error.code === "FORBIDDEN_TRANSITION") {
        return errorResponse(422, error.message, error.code);
      }
    }

    console.error("[INTERNAL_FIELDWORK_CANDIDATE_LIFECYCLE_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
