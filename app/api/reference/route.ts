import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

const REFERENCE_TYPES = [
  "constraint",
  "pattern",
  "goal",
  "preference",
  "assumption",
  "hypothesis",
] as const;

const REFERENCE_CONFIDENCE = ["low", "medium", "high"] as const;

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
    const type = body?.type;
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

    if (sourceSessionId) {
      const session = await prismadb.session.findFirst({
        where: {
          id: sourceSessionId,
          userId,
        },
        select: { id: true },
      });

      if (!session) {
        return new NextResponse("Source session not found", { status: 404 });
      }
    }

    if (sourceMessageId) {
      const message = await prismadb.message.findFirst({
        where: {
          id: sourceMessageId,
          userId,
        },
        select: { id: true },
      });

      if (!message) {
        return new NextResponse("Source message not found", { status: 404 });
      }
    }

    const existingItem = await prismadb.referenceItem.findFirst({
      where: {
        userId,
        type,
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
          sourceSessionId: sourceSessionId || null,
          sourceMessageId: sourceMessageId || null,
        },
        select,
      });

      return NextResponse.json(updatedItem);
    }

    const referenceItem = await prismadb.referenceItem.create({
      data: {
        userId,
        statement,
        type,
        confidence,
        status: "active",
        sourceSessionId: sourceSessionId || null,
        sourceMessageId: sourceMessageId || null,
      },
      select,
    });

    return NextResponse.json(referenceItem);
  } catch (error) {
    console.log("[REFERENCE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
