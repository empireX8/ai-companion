import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  detailSuccess,
  errorResponse,
  hasDisputedRecoveryRationale,
  isAllowedUserMapTransition,
  userMapConclusionPatchSchema,
  zodIssuesToDetails,
} from "../../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

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
    const item = await prismadb.userMapConclusion.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    return detailSuccess(item);
  } catch (error) {
    console.error("[USER_MAP_CONCLUSION_GET_ERROR]", error);
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

  const parsed = userMapConclusionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "Validation failed",
      "VALIDATION_ERROR",
      zodIssuesToDetails(parsed.error.issues)
    );
  }

  try {
    const current = await prismadb.userMapConclusion.findFirst({
      where: { id, userId },
    });

    if (!current) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    const nextStatus = parsed.data.status;

    if (nextStatus && !isAllowedUserMapTransition(current.status, nextStatus)) {
      return errorResponse(
        422,
        "Unsupported lifecycle transition",
        "UNSUPPORTED_TRANSITION"
      );
    }

    if (current.status === "disputed" && nextStatus === "supported") {
      return errorResponse(
        422,
        "Unsupported lifecycle transition",
        "UNSUPPORTED_TRANSITION"
      );
    }

    if (
      current.status === "disputed" &&
      (nextStatus === "tentative" || nextStatus === "emerging")
    ) {
      const hasRationale = hasDisputedRecoveryRationale({
        currentEvidenceCount: current.evidenceCount,
        currentSourceDiversity: current.sourceDiversity,
        currentTimeSpreadDays: current.timeSpreadDays,
        patchEvidenceCount: parsed.data.evidenceCount,
        patchSourceDiversity: parsed.data.sourceDiversity,
        patchTimeSpreadDays: parsed.data.timeSpreadDays,
        notes: parsed.data.notes ?? null,
        lastUserCorrectionLabel: parsed.data.lastUserCorrectionLabel ?? null,
      });

      if (!hasRationale) {
        return errorResponse(
          422,
          "Unsupported lifecycle transition",
          "UNSUPPORTED_TRANSITION",
          [
            {
              field: "status",
              message:
                "disputed recovery requires explicit evidence or correction rationale",
            },
          ]
        );
      }
    }

    if (parsed.data.supersededById) {
      const supersededBy = await prismadb.userMapConclusion.findFirst({
        where: { id: parsed.data.supersededById, userId },
        select: { id: true },
      });
      if (!supersededBy) {
        return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
          {
            field: "supersededById",
            message: "Must belong to authenticated user",
          },
        ]);
      }
    }

    if (parsed.data.supersedesId) {
      const supersedes = await prismadb.userMapConclusion.findFirst({
        where: { id: parsed.data.supersedesId, userId },
        select: { id: true },
      });
      if (!supersedes) {
        return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
          {
            field: "supersedesId",
            message: "Must belong to authenticated user",
          },
        ]);
      }
    }

    const updated = await prismadb.userMapConclusion.update({
      where: { id },
      data: parsed.data,
    });

    return detailSuccess(updated);
  } catch (error) {
    console.error("[USER_MAP_CONCLUSION_PATCH_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
