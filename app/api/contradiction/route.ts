import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { computeRecommendedRung } from "@/lib/contradiction-escalation";
import { CONTRADICTION_STATUS } from "@/lib/contradiction-enums";
import { createContradictionSchema } from "@/lib/contradiction-schema";
import { getTop3WithOptionalSurfacing } from "@/lib/contradiction-surface";
import {
  ContradictionSourceError,
  resolveContradictionSource,
} from "@/lib/contradiction-source";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const CONTRADICTION_WITH_EVIDENCE = {
  id: true,
  userId: true,
  title: true,
  sideA: true,
  sideB: true,
  type: true,
  confidence: true,
  status: true,
  weight: true,
  snoozeCount: true,
  timesSurfaced: true,
  lastSurfacedAt: true,
  lastEvidenceAt: true,
  evidenceCount: true,
  recommendedRung: true,
  escalationLevel: true,
  avoidanceCount: true,
  lastEscalatedAt: true,
  lastAvoidedAt: true,
  rung: true,
  snoozedUntil: true,
  createdAt: true,
  lastTouchedAt: true,
  sourceSessionId: true,
  sourceMessageId: true,
  evidence: {
    orderBy: {
      createdAt: "desc",
    },
  },
  _count: {
    select: {
      evidence: true,
    },
  },
} as const;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const parsed = createContradictionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    let source;
    try {
      source = await resolveContradictionSource({
        userId,
        sourceSessionId: input.sourceSessionId,
        sourceMessageId: input.sourceMessageId,
        db: prismadb,
      });
    } catch (error) {
      if (error instanceof ContradictionSourceError) {
        return new NextResponse(error.message, { status: error.status });
      }
      throw error;
    }

    let evidenceSources: Array<{
      sessionId: string;
      messageId: string;
      quote: string | null;
    }> = [];
    if (input.evidence?.length) {
      evidenceSources = await Promise.all(
        input.evidence.map(async (item) => {
          let resolved;
          try {
            resolved = await resolveContradictionSource({
              userId,
              sourceSessionId: item.sessionId,
              sourceMessageId: item.messageId,
              db: prismadb,
            });
          } catch (error) {
            if (error instanceof ContradictionSourceError) {
              throw error;
            }
            throw error;
          }

          return {
            sessionId: resolved.sourceSessionId,
            messageId: resolved.sourceMessageId,
            quote: item.quote?.trim() || null,
          };
        })
      );
    }

    const createdNode = await prismadb.$transaction(async (tx) => {
      const node = await tx.contradictionNode.create({
        data: {
          userId,
          title: input.title,
          sideA: input.sideA,
          sideB: input.sideB,
          type: input.type,
          confidence: input.confidence,
          rung: input.rung ?? null,
          recommendedRung: computeRecommendedRung(0),
          escalationLevel: 0,
          snoozedUntil: input.snoozedUntil ? new Date(input.snoozedUntil) : null,
          evidenceCount: evidenceSources.length,
          lastEvidenceAt: evidenceSources.length ? new Date() : null,
          sourceSessionId: source.sourceSessionId || null,
          sourceMessageId: source.sourceMessageId || null,
        },
        select: { id: true },
      });

      if (evidenceSources.length) {
        await tx.contradictionEvidence.createMany({
          data: evidenceSources.map((item) => ({
            nodeId: node.id,
            sessionId: item.sessionId || null,
            messageId: item.messageId || null,
            quote: item.quote,
          })),
        });
      }

      return tx.contradictionNode.findUnique({
        where: { id: node.id },
        select: CONTRADICTION_WITH_EVIDENCE,
      });
    });

    return NextResponse.json(createdNode);
  } catch (error) {
    if (error instanceof ContradictionSourceError) {
      return new NextResponse(error.message, { status: error.status });
    }

    console.log("[CONTRADICTION_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const topParam = searchParams.get("top");
    const statusParam = searchParams.get("status");
    const modeParam = searchParams.get("mode");

    let nodes: Array<
      Awaited<ReturnType<typeof prismadb.contradictionNode.findMany>>[number]
    > = [];

    if (topParam !== null) {
      if (topParam !== "3") {
        return new NextResponse("Invalid top value", { status: 400 });
      }
      if (modeParam && modeParam !== "read_only" && modeParam !== "recorded") {
        return new NextResponse("Invalid mode value", { status: 400 });
      }

      const { items } = await getTop3WithOptionalSurfacing({
        userId,
        mode: modeParam === "read_only" ? "read_only" : "recorded",
      });
      const topIds = items.map((item) => item.id);

      if (topIds.length) {
        const selected = await prismadb.contradictionNode.findMany({
          where: {
            userId,
            id: {
              in: topIds,
            },
          },
          select: CONTRADICTION_WITH_EVIDENCE,
        });

        const selectedById = new Map(selected.map((item) => [item.id, item]));
        nodes = topIds
          .map((id) => selectedById.get(id))
          .filter((item): item is (typeof selected)[number] => Boolean(item));
      }
    } else {
      const typedStatus = statusParam as
        | (typeof CONTRADICTION_STATUS)[number]
        | null;

      if (typedStatus && !CONTRADICTION_STATUS.includes(typedStatus)) {
        return new NextResponse("Invalid contradiction status", { status: 400 });
      }

      nodes = await prismadb.contradictionNode.findMany({
        where: {
          userId,
          ...(typedStatus ? { status: typedStatus } : {}),
        },
        orderBy: [{ weight: "desc" }, { lastTouchedAt: "desc" }],
        take: 50,
        select: CONTRADICTION_WITH_EVIDENCE,
      });
    }

    return NextResponse.json(nodes, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.log("[CONTRADICTION_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
