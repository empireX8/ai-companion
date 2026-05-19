import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  getWindowStartDate,
  resolveTimelineWindow,
} from "../../../../lib/timeline-aggregation";
import {
  TIMELINE_MODEL_LAYERS_LIMIT,
  toTimelineModelLayerItem,
} from "../../../../lib/timeline-model-layers";
import { applyVerifiedAffectedObjectHrefs } from "../../../../lib/public-linked-object-continuity";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const windowValue = resolveTimelineWindow(searchParams.get("window"));
  const windowStart = getWindowStartDate(windowValue, new Date());

  try {
    const rows = await prismadb.modelUpdate.findMany({
      where: {
        userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
        createdAt: { gte: windowStart },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TIMELINE_MODEL_LAYERS_LIMIT,
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
      .map((row) => toTimelineModelLayerItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const verifiedItems = await applyVerifiedAffectedObjectHrefs({
      userId,
      items,
    });

    return NextResponse.json({ items: verifiedItems });
  } catch (error) {
    console.error("[TIMELINE_MODEL_LAYERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
