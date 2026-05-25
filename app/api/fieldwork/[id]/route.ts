import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  detailSuccess,
  errorResponse,
  fieldworkPatchSchema,
  hasFieldworkObservationPayload,
  isAllowedFieldworkTransition,
  zodIssuesToDetails,
} from "../../../../lib/understanding-engine-api";
import { verifyUnderstandingEvidenceLinkTargetOwnership } from "../../../../lib/understanding-evidence-link-writer";

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
    const item = await prismadb.fieldworkAssignment.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    return detailSuccess(item);
  } catch (error) {
    console.error("[FIELDWORK_ITEM_GET_ERROR]", error);
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

  const parsed = fieldworkPatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "Validation failed",
      "VALIDATION_ERROR",
      zodIssuesToDetails(parsed.error.issues)
    );
  }

  try {
    const current = await prismadb.fieldworkAssignment.findFirst({
      where: { id, userId },
    });

    if (!current) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    const nextStatus = parsed.data.status;
    if (nextStatus && !isAllowedFieldworkTransition(current.status, nextStatus)) {
      return errorResponse(
        422,
        "Unsupported lifecycle transition",
        "UNSUPPORTED_TRANSITION"
      );
    }

    if (parsed.data.expiresAt && parsed.data.expiresAt <= new Date()) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: "expiresAt",
          message: "expiresAt must be in the future",
        },
      ]);
    }

    const effectiveStatus = nextStatus ?? current.status;
    const effectiveObservationNote =
      parsed.data.observationNote ?? current.observationNote;
    const effectiveObservationOutcome =
      parsed.data.observationOutcome ?? current.observationOutcome;
    const effectiveLinkedObjectType =
      parsed.data.linkedObjectType ?? current.linkedObjectType;
    const effectiveLinkedObjectId =
      parsed.data.linkedObjectId ?? current.linkedObjectId;

    if (
      effectiveStatus === "completed" &&
      !hasFieldworkObservationPayload({
        observationNote: effectiveObservationNote,
        observationOutcome: effectiveObservationOutcome,
      })
    ) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: "status",
          message:
            "completed status requires observationNote or observationOutcome",
        },
      ]);
    }

    if (
      parsed.data.linkedObjectType !== undefined ||
      parsed.data.linkedObjectId !== undefined
    ) {
      const linkedObjectOwned = await verifyUnderstandingEvidenceLinkTargetOwnership({
        userId,
        targetType: effectiveLinkedObjectType,
        targetId: effectiveLinkedObjectId,
      });
      if (!linkedObjectOwned) {
        return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
          {
            field: "linkedObjectId",
            message: "Linked object not found for authenticated user",
          },
        ]);
      }
    }

    const data = {
      ...parsed.data,
      ...(effectiveStatus === "completed" && !parsed.data.completedAt
        ? { completedAt: current.completedAt ?? new Date() }
        : {}),
    };

    const updated = await prismadb.fieldworkAssignment.update({
      where: { id },
      data,
    });

    return detailSuccess(updated);
  } catch (error) {
    console.error("[FIELDWORK_ITEM_PATCH_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
