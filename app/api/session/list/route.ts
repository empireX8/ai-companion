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
      originParam !== "app" &&
      originParam !== "imported" &&
      originParam !== "all"
    ) {
      return new NextResponse("Invalid origin value", { status: 400 });
    }

    // Build the where clause. Default to APP sessions only.
    const originWhere =
      originParam === "all"
        ? undefined
        : originParam === "imported"
          ? { origin: "IMPORTED_ARCHIVE" as const }
          : { origin: "APP" as const };

    const sessions = await prismadb.session.findMany({
      where: { userId, ...originWhere },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        label: true,
        startedAt: true,
        endedAt: true,
        origin: true,
        importedSource: true,
        importedAt: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.log("[SESSION_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
