import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  EXPLORE_INVESTIGATIONS_LIMIT,
  buildPublicExploreInvestigationWhere,
  dedupeExploreInvestigationItems,
  toExploreInvestigationItem,
  type ExploreInvestigationItem,
} from "../../../../lib/investigations";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prismadb.investigation.findMany({
      where: buildPublicExploreInvestigationWhere({ userId }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: EXPLORE_INVESTIGATIONS_LIMIT,
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const items = dedupeExploreInvestigationItems(
      rows
        .map((row) => toExploreInvestigationItem(row))
        .filter((item): item is ExploreInvestigationItem => Boolean(item))
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[EXPLORE_INVESTIGATIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
