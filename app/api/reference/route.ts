import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { REFERENCE_CONFIDENCE, REFERENCE_TYPES } from "@/lib/reference-enums";
import { isRuleLikeStatement } from "@/lib/memory-governance";
import prismadb from "@/lib/prismadb";
import { ReferenceSourceError, resolveReferenceSource } from "@/lib/reference-source";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const statementValue = typeof body?.statement === "string" ? body.statement : "";
    const statement = statementValue.trim();
    const requestedType = body?.type;
    const confidence = body?.confidence;
    const sourceSessionIdValue =
      typeof body?.sourceSessionId === "string" ? body.sourceSessionId : "";
    const sourceMessageIdValue =
      typeof body?.sourceMessageId === "string" ? body.sourceMessageId : "";
    const sourceSessionId = sourceSessionIdValue.trim();
    const sourceMessageId = sourceMessageIdValue.trim();

    if (!statement) {
      return new NextResponse("Statement is required", { status: 400 });
    }

    const effectiveType = isRuleLikeStatement(statement) ? "rule" : requestedType;

    if (effectiveType !== "rule" && !REFERENCE_TYPES.includes(effectiveType)) {
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

    const existingItem = await prismadb.referenceItem.findFirst({
      where: {
        userId,
        type: effectiveType,
        statement,
        status: "active",
      },
      select: { id: true },
    });

    const select = {
      id: true,
      type: true,
      confidence: true,
      statement: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    if (existingItem) {
      const updatedItem = await prismadb.referenceItem.update({
        where: { id: existingItem.id },
        data: {
          confidence,
          status: "active",
          sourceSessionId: source.sourceSessionId || null,
          sourceMessageId: source.sourceMessageId || null,
        },
        select,
      });

      return NextResponse.json(updatedItem);
    }

    const referenceItem = await prismadb.referenceItem.create({
      data: {
        userId,
        statement,
        type: effectiveType,
        confidence,
        status: "active",
        sourceSessionId: source.sourceSessionId || null,
        sourceMessageId: source.sourceMessageId || null,
      },
      select,
    });

    return NextResponse.json(referenceItem);
  } catch (error) {
    console.log("[REFERENCE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
