import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  REFERENCE_CONFIDENCE,
  REFERENCE_STATUS,
  REFERENCE_TYPES,
} from "@/lib/reference-enums";
import prismadb from "@/lib/prismadb";

type ReferenceConfidence = "low" | "medium" | "high";

const CONFIDENCE_SCORE: Record<ReferenceConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const REFERENCE_SELECT = {
  id: true,
  type: true,
  confidence: true,
  statement: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sourceSessionId: true,
  sourceMessageId: true,
  supersedesId: true,
} as const;

const maxConfidence = (
  left: ReferenceConfidence,
  right: ReferenceConfidence
): ReferenceConfidence => {
  return CONFIDENCE_SCORE[left] >= CONFIDENCE_SCORE[right] ? left : right;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;
    if (!id) {
      return new NextResponse("Reference id is required", { status: 400 });
    }

    const currentItem = await prismadb.referenceItem.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        statement: true,
        type: true,
        confidence: true,
        status: true,
      },
    });

    if (!currentItem) {
      return new NextResponse("Reference not found", { status: 404 });
    }

    const body = await req.json();
    const hasStatement = typeof body?.statement === "string";
    const hasType = typeof body?.type === "string";
    const hasConfidence = typeof body?.confidence === "string";
    const hasStatus = typeof body?.status === "string";

    if (!hasStatement && !hasType && !hasConfidence && !hasStatus) {
      return new NextResponse("No updates provided", { status: 400 });
    }

    const statement = hasStatement ? String(body.statement).trim() : currentItem.statement;
    if (!statement) {
      return new NextResponse("Statement is required", { status: 400 });
    }

    const type = hasType ? body.type : currentItem.type;
    if (!REFERENCE_TYPES.includes(type)) {
      return new NextResponse("Invalid reference type", { status: 400 });
    }

    const confidence = hasConfidence ? body.confidence : currentItem.confidence;
    if (!REFERENCE_CONFIDENCE.includes(confidence)) {
      return new NextResponse("Invalid confidence", { status: 400 });
    }

    const status = hasStatus ? body.status : currentItem.status;
    if (!REFERENCE_STATUS.includes(status)) {
      return new NextResponse("Invalid status", { status: 400 });
    }

    const shouldCheckDedupe = statement !== currentItem.statement || type !== currentItem.type;

    if (shouldCheckDedupe) {
      const existingActive = await prismadb.referenceItem.findFirst({
        where: {
          userId,
          id: { not: id },
          type,
          statement,
          status: "active",
        },
        select: {
          id: true,
          confidence: true,
        },
      });

      if (existingActive) {
        const canonical = await prismadb.$transaction(async (tx) => {
          const updatedExisting = await tx.referenceItem.update({
            where: { id: existingActive.id },
            data: {
              confidence: maxConfidence(existingActive.confidence, confidence),
              status: "active",
            },
            select: REFERENCE_SELECT,
          });

          await tx.referenceItem.update({
            where: { id },
            data: {
              status: "superseded",
              supersedesId: existingActive.id,
            },
          });

          return updatedExisting;
        });

        return NextResponse.json(canonical);
      }
    }

    const updatedItem = await prismadb.referenceItem.update({
      where: { id },
      data: {
        statement,
        type,
        confidence,
        status,
      },
      select: REFERENCE_SELECT,
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.log("[REFERENCE_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
