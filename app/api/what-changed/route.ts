import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  WHAT_CHANGED_LIMIT,
  toWhatChangedItem,
} from "../../../lib/what-changed";
import { applyVerifiedAffectedObjectHrefs } from "../../../lib/public-linked-object-continuity";

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
      take: WHAT_CHANGED_LIMIT,
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
      .map((row) => toWhatChangedItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const verifiedItems = await applyVerifiedAffectedObjectHrefs({
      userId,
      items,
    });

    return NextResponse.json({ items: verifiedItems });
  } catch (error) {
    console.error("[WHAT_CHANGED_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
