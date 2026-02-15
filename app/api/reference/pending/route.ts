import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId")?.trim() ?? "";

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

    const pendingCandidate = await prismadb.referenceItem.findFirst({
      where: {
        userId,
        sourceSessionId: sessionId,
        status: "candidate",
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        type: true,
        confidence: true,
        statement: true,
        sourceSessionId: true,
        sourceMessageId: true,
        supersedesId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(pendingCandidate, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.log("[REFERENCE_PENDING_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

