import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  detailSuccess,
  errorResponse,
  isAllowedModelUpdateVisibilityTransition,
  modelUpdatePatchSchema,
  zodIssuesToDetails,
} from "../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

const MODEL_UPDATE_SAFE_SELECT = {
  id: true,
  userId: true,
  updateType: true,
  visibility: true,
  affectedObjectType: true,
  affectedObjectId: true,
  userFacingSummary: true,
  isMeaningful: true,
  beforeSummary: true,
  afterSummary: true,
  confidenceDelta: true,
  meaningfulDeltaScore: true,
  sourceRunId: true,
  createdAt: true,
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  const { id } = await params;

  try {
    const item = await prismadb.modelUpdate.findFirst({
      where: { id, userId },
      select: MODEL_UPDATE_SAFE_SELECT,
    });

    if (!item) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    return detailSuccess(item);
  } catch (error) {
    console.error("[MODEL_UPDATE_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
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

  const parsed = modelUpdatePatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "Validation failed",
      "VALIDATION_ERROR",
      zodIssuesToDetails(parsed.error.issues)
    );
  }

  try {
    const current = await prismadb.modelUpdate.findFirst({
      where: { id, userId },
      select: { id: true, visibility: true },
    });

    if (!current) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    if (
      parsed.data.visibility &&
      !isAllowedModelUpdateVisibilityTransition(
        current.visibility,
        parsed.data.visibility
      )
    ) {
      return errorResponse(
        422,
        "Unsupported lifecycle transition",
        "UNSUPPORTED_TRANSITION"
      );
    }

    const updated = await prismadb.modelUpdate.update({
      where: { id },
      data: parsed.data,
      select: MODEL_UPDATE_SAFE_SELECT,
    });

    return detailSuccess(updated);
  } catch (error) {
    console.error("[MODEL_UPDATE_PATCH_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
