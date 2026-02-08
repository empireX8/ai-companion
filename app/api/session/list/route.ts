import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sessions = await prismadb.session.findMany({
      where: { userId },
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
