import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { rejectExploreMovementProposal } from "@/lib/explore-movement-proposal";

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
      return new NextResponse("Malformed payload", { status: 400 });
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

    const result = await rejectExploreMovementProposal({
      userId,
      proposalId,
      db: prismadb,
    });

    if (result === "not_found") {
      return new NextResponse("Proposal not found", { status: 404 });
    }
    if (result === "already_published") {
      return new NextResponse("Proposal already published", { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      proposalId: result.proposalId,
    });
  } catch (error) {
    console.log("[EXPLORE_PROPOSAL_REJECT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
