import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

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
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.log("[MESSAGE_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
