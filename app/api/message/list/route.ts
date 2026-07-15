import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { isExploreGroundingPayload } from "@/lib/explore-grounding-contract";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return new NextResponse("Session id is required", { status: 400 });
    }

    const session = await prismadb.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return new NextResponse("Session not found", { status: 404 });
    }

    const messages = await prismadb.message.findMany({
      where: {
        sessionId: session.id,
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        groundingPayload: true,
      },
    });

    return NextResponse.json(
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        grounding:
          message.groundingPayload && isExploreGroundingPayload(message.groundingPayload)
            ? message.groundingPayload
            : null,
      }))
    );
  } catch (error) {
    console.log("[MESSAGE_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
