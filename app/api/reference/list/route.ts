import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const items = await prismadb.referenceItem.findMany({
      where: {
        userId,
        status: { in: ["active", "candidate", "inactive"] },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        type: true,
        confidence: true,
        statement: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sourceSessionId: true,
        supersedesId: true,
        supersedes: { select: { statement: true } },
      },
    });

    // Batch-fetch session origins for items that have a sourceSessionId.
    const sessionIds = [
      ...new Set(
        items.map((i) => i.sourceSessionId).filter((id): id is string => id !== null)
      ),
    ];
    const sessionOrigins: Record<string, string> = {};
    if (sessionIds.length > 0) {
      const sessions = await prismadb.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, origin: true },
      });
      for (const s of sessions) sessionOrigins[s.id] = s.origin;
    }

    const enriched = items.map((item) => ({
      ...item,
      sessionOrigin: item.sourceSessionId
        ? (sessionOrigins[item.sourceSessionId] ?? null)
        : null,
      supersedesStatement: item.supersedes?.statement ?? null,
      supersedes: undefined,
    }));

    return NextResponse.json(enriched, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.log("[REFERENCE_LIST_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
