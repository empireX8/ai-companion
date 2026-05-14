import { auth } from "@clerk/nextjs/server";
import { InvestigationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  detailSuccess,
  errorResponse,
  investigationPatchSchema,
  isAllowedInvestigationTransition,
  zodIssuesToDetails,
} from "../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

function isResolvedAtCompatibleStatus(status: InvestigationStatus): boolean {
  return status === "resolving" || status === "resolved" || status === "reopened";
}

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
    const item = await prismadb.investigation.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    return detailSuccess(item);
  } catch (error) {
    console.error("[INVESTIGATION_GET_ERROR]", error);
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

  const parsed = investigationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "Validation failed",
      "VALIDATION_ERROR",
      zodIssuesToDetails(parsed.error.issues)
    );
  }

  try {
    const current = await prismadb.investigation.findFirst({
      where: { id, userId },
    });

    if (!current) {
      return errorResponse(404, "Not found", "NOT_FOUND");
    }

    const nextStatus = parsed.data.status;
    if (nextStatus && !isAllowedInvestigationTransition(current.status, nextStatus)) {
      return errorResponse(
        422,
        "Unsupported lifecycle transition",
        "UNSUPPORTED_TRANSITION"
      );
    }

    const effectiveStatus = nextStatus ?? current.status;
    if (parsed.data.resolvedAt && !isResolvedAtCompatibleStatus(effectiveStatus)) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: "resolvedAt",
          message: "resolvedAt requires resolving, resolved, or reopened status",
        },
      ]);
    }

    if (parsed.data.resolvedIntoUserMapConclusionId) {
      const linkedConclusion = await prismadb.userMapConclusion.findFirst({
        where: { id: parsed.data.resolvedIntoUserMapConclusionId, userId },
        select: { id: true },
      });

      if (!linkedConclusion) {
        return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
          {
            field: "resolvedIntoUserMapConclusionId",
            message: "Must belong to authenticated user",
          },
        ]);
      }
    }

    const updateData: Prisma.InvestigationUncheckedUpdateInput = {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.organizingQuestion !== undefined
        ? { organizingQuestion: parsed.data.organizingQuestion }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.seedType !== undefined
        ? { seedType: parsed.data.seedType }
        : {}),
      ...(parsed.data.competingTheories !== undefined
        ? {
            competingTheories:
              parsed.data.competingTheories as Prisma.InputJsonValue,
          }
        : {}),
      ...(parsed.data.evidenceNeeded !== undefined
        ? { evidenceNeeded: parsed.data.evidenceNeeded as Prisma.InputJsonValue }
        : {}),
      ...(parsed.data.resolutionSummary !== undefined
        ? { resolutionSummary: parsed.data.resolutionSummary }
        : {}),
      ...(parsed.data.resolvedAt !== undefined
        ? { resolvedAt: parsed.data.resolvedAt }
        : {}),
      ...(parsed.data.resolvedIntoUserMapConclusionId !== undefined
        ? {
            resolvedIntoUserMapConclusionId:
              parsed.data.resolvedIntoUserMapConclusionId,
          }
        : {}),
      ...(parsed.data.reopenedAt !== undefined
        ? { reopenedAt: parsed.data.reopenedAt }
        : {}),
      ...(parsed.data.reopenReason !== undefined
        ? { reopenReason: parsed.data.reopenReason }
        : {}),
      ...(parsed.data.priority !== undefined
        ? { priority: parsed.data.priority }
        : {}),
    };

    const updated = await prismadb.investigation.update({
      where: { id },
      data: updateData,
    });

    return detailSuccess(updated);
  } catch (error) {
    console.error("[INVESTIGATION_PATCH_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
