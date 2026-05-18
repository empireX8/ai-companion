import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  TODAY_INTELLIGENCE_UPDATES_LIMIT,
  toTodayIntelligenceUpdateItem,
} from "../../../../lib/today-intelligence-updates";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prismadb.modelUpdate.findMany({
      where: {
        userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TODAY_INTELLIGENCE_UPDATES_LIMIT,
      select: {
        id: true,
        updateType: true,
        affectedObjectType: true,
        affectedObjectId: true,
        userFacingSummary: true,
        createdAt: true,
      },
    });

    const items = rows
      .map((row) => toTodayIntelligenceUpdateItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[TODAY_INTELLIGENCE_UPDATES_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
