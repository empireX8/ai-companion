import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { isExploreGroundingPayload } from "@/lib/explore-grounding-contract";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: messageIdRaw } = await context.params;
    const messageId = messageIdRaw?.trim();
    if (!messageId) {
      return new NextResponse("Message id is required", { status: 400 });
    }

    const message = await prismadb.message.findFirst({
      where: { id: messageId, userId },
      select: {
        id: true,
        sessionId: true,
        role: true,
        groundingPayload: true,
        session: {
          select: {
            id: true,
            userId: true,
            surfaceType: true,
          },
        },
      },
    });

    if (!message || message.session.userId !== userId) {
      return new NextResponse("Message not found", { status: 404 });
    }

    const grounding =
      message.groundingPayload && isExploreGroundingPayload(message.groundingPayload)
        ? message.groundingPayload
        : null;

    return NextResponse.json({
      messageId: message.id,
      conversationId: message.sessionId,
      role: message.role,
      grounding,
    });
  } catch (error) {
    console.log("[EXPLORE_MESSAGE_GROUNDING_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
