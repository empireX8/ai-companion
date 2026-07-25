import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { isExploreGroundingPayload } from "@/lib/explore-grounding-contract";
import { EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS } from "@/lib/explore-movement-fixed-semantics-containment";
import { EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE } from "@/lib/explore-movement-proposal-provenance";
import { publishExploreMovementProposal } from "@/lib/explore-movement-proposal";

type RouteContext = {
  params: Promise<{ id: string; proposalId: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: sessionIdRaw, proposalId: proposalIdRaw } = await context.params;
    const sessionId = sessionIdRaw?.trim();
    const proposalId = proposalIdRaw?.trim();
    if (!sessionId || !proposalId) {
      return new NextResponse("Malformed publication payload", { status: 400 });
    }

    const session = await prismadb.session.findFirst({
      where: {
        id: sessionId,
        userId,
        surfaceType: "explore_chat",
      },
      select: { id: true },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 404 });
    }

    const proposal = await prismadb.exploreMovementProposal.findFirst({
      where: { id: proposalId, userId },
      select: { id: true },
    });

    if (!proposal) {
      return new NextResponse("Proposal not found", { status: 404 });
    }

    const result = await publishExploreMovementProposal({
      userId,
      proposalId,
      conversationId: sessionId,
      db: prismadb,
    });

    if (result === "not_found") {
      return new NextResponse("Proposal not found", { status: 404 });
    }
    if (result === "rejected") {
      return new NextResponse("Proposal was rejected", { status: 409 });
    }
    if (result === "missing_evidence") {
      return new NextResponse("Proposal missing evidence links", { status: 409 });
    }
    if (result === EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS) {
      return NextResponse.json(
        {
          ok: false,
          error: EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS,
          status: "blocked",
        },
        { status: 409 }
      );
    }
    if (result === EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE) {
      return NextResponse.json(
        {
          ok: false,
          error: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
          status: "blocked",
        },
        { status: 409 }
      );
    }

    const assistantMessages = await prismadb.message.findMany({
      where: {
        userId,
        sessionId,
        role: "assistant",
        groundingPayload: { not: Prisma.DbNull },
      },
      select: { id: true, groundingPayload: true },
    });

    for (const message of assistantMessages) {
      if (!isExploreGroundingPayload(message.groundingPayload)) continue;
      if (message.groundingPayload.movementProposal.proposalId !== proposalId) continue;
      await prismadb.message.update({
        where: { id: message.id },
        data: {
          groundingPayload: {
            ...message.groundingPayload,
            movementProposal: {
              ...message.groundingPayload.movementProposal,
              status: "published",
              modelUpdateId: result.modelUpdateId,
            },
          },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      modelUpdateId: result.modelUpdateId,
      idempotent: result.idempotent,
    });
  } catch (error) {
    console.log("[EXPLORE_PROPOSAL_PUBLISH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
