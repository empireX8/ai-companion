import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  parseSessionSurfaceTypeQuery,
  type SessionSurfaceTypeValue,
} from "../../../../lib/session-surface-type";

function buildSessionWhere(
  userId: string,
  originParam: "app" | "imported" | "all" | null,
  surfaceType: SessionSurfaceTypeValue | null
): Prisma.SessionWhereInput {
  if (originParam === "imported") {
    return {
      userId,
      origin: "IMPORTED_ARCHIVE",
    };
  }

  if (originParam === "all") {
    if (!surfaceType) {
      return { userId };
    }

    return {
      userId,
      OR: [
        { origin: "IMPORTED_ARCHIVE" },
        { origin: "APP", surfaceType },
      ],
    };
  }

  return {
    userId,
    origin: "APP",
    ...(surfaceType ? { surfaceType } : {}),
  };
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const originParam = searchParams.get("origin");
    const surfaceTypeParam = searchParams.get("surfaceType");

    if (
      originParam !== null &&
      originParam !== "app" &&
      originParam !== "imported" &&
      originParam !== "all"
    ) {
      return new NextResponse("Invalid origin value", { status: 400 });
    }

    const parsedSurfaceType = parseSessionSurfaceTypeQuery(surfaceTypeParam);
    if (!parsedSurfaceType.ok) {
      return new NextResponse("Invalid surfaceType value", { status: 400 });
    }

    const where = buildSessionWhere(
      userId,
      originParam as "app" | "imported" | "all" | null,
      parsedSurfaceType.value
    );

    const sessions = await prismadb.session.findMany({
      where,
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
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    const result = sessions.map(({ messages, ...s }) => ({
      ...s,
      preview: messages[0]?.content ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.log("[SESSION_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
