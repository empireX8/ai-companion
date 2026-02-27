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
    const originParam = searchParams.get("origin");

    if (
      originParam !== null &&
      originParam !== "native" &&
      originParam !== "imported"
    ) {
      return new NextResponse("Invalid origin value", { status: 400 });
    }

    // Default to "native" — imported archive must be explicitly requested.
    const origin = originParam ?? "native";

    const sessions = await prismadb.session.findMany({
      where: { userId, origin },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        label: true,
        startedAt: true,
        endedAt: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.log("[SESSION_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
