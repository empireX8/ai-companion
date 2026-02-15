import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { REFERENCE_CONFIDENCE, REFERENCE_TYPES } from "@/lib/reference-enums";
import prismadb from "@/lib/prismadb";
import { ReferenceSourceError, resolveReferenceSource } from "@/lib/reference-source";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const oldId = typeof body?.oldId === "string" ? body.oldId.trim() : "";
    const statementValue = typeof body?.statement === "string" ? body.statement : "";
    const statement = statementValue.trim();
    const type = body?.type;
    const confidence = body?.confidence;
    const sourceSessionIdValue =
      typeof body?.sourceSessionId === "string" ? body.sourceSessionId : "";
    const sourceMessageIdValue =
      typeof body?.sourceMessageId === "string" ? body.sourceMessageId : "";
    const sourceSessionId = sourceSessionIdValue.trim();
    const sourceMessageId = sourceMessageIdValue.trim();

    if (!oldId) {
      return new NextResponse("Old reference id is required", { status: 400 });
    }

    if (!statement) {
      return new NextResponse("Statement is required", { status: 400 });
    }

    if (!REFERENCE_TYPES.includes(type)) {
      return new NextResponse("Invalid reference type", { status: 400 });
    }

    if (!REFERENCE_CONFIDENCE.includes(confidence)) {
      return new NextResponse("Invalid confidence", { status: 400 });
    }

    if (sourceSessionId && !UUID_PATTERN.test(sourceSessionId)) {
      return new NextResponse("Invalid source session id", { status: 400 });
    }

    if (sourceMessageId && !UUID_PATTERN.test(sourceMessageId)) {
      return new NextResponse("Invalid source message id", { status: 400 });
    }

    let source;
    try {
      source = await resolveReferenceSource({
        userId,
        sourceSessionId,
        sourceMessageId,
        db: prismadb,
      });
    } catch (error) {
      if (error instanceof ReferenceSourceError) {
        return new NextResponse(error.message, { status: error.status });
      }
      throw error;
    }

    const oldItem = await prismadb.referenceItem.findFirst({
      where: {
        id: oldId,
        userId,
        status: "active",
      },
      select: REFERENCE_SELECT,
    });

    if (!oldItem) {
      return new NextResponse("Active source reference not found", { status: 404 });
    }

    const result = await prismadb.$transaction(async (tx) => {
      const existingActive = await tx.referenceItem.findFirst({
        where: {
          userId,
          type,
          statement,
          status: "active",
        },
        select: REFERENCE_SELECT,
      });

      if (existingActive) {
        const supersededOld = await tx.referenceItem.update({
          where: { id: oldId },
          data: {
            status: "superseded",
            supersedesId: existingActive.id,
          },
          select: REFERENCE_SELECT,
        });

        return {
          newActiveItem: existingActive,
          oldItem: supersededOld,
        };
      }

      const newActiveItem = await tx.referenceItem.create({
        data: {
          userId,
          statement,
          type,
          confidence,
          status: "active",
          sourceSessionId: source.sourceSessionId || null,
          sourceMessageId: source.sourceMessageId || null,
        },
        select: REFERENCE_SELECT,
      });

      const supersededOld = await tx.referenceItem.update({
        where: { id: oldId },
        data: {
          status: "superseded",
          supersedesId: newActiveItem.id,
        },
        select: REFERENCE_SELECT,
      });

      return {
        newActiveItem,
        oldItem: supersededOld,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.log("[REFERENCE_SUPERSEDE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
