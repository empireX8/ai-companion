import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { toWhatChangedListItem } from "../../../../lib/public-intelligence-safe-slice";
import { applyVerifiedAffectedObjectHrefs } from "../../../../lib/public-linked-object-continuity";

export const dynamic = "force-dynamic";

const PUBLIC_MODEL_UPDATE_DETAIL_SELECT = {
  id: true,
  updateType: true,
  affectedObjectType: true,
  affectedObjectId: true,
  userFacingSummary: true,
  createdAt: true,
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const row = await prismadb.modelUpdate.findFirst({
      where: {
        id,
        userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      },
      select: PUBLIC_MODEL_UPDATE_DETAIL_SELECT,
    });

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = toWhatChangedListItem(row);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [verified] = await applyVerifiedAffectedObjectHrefs({
      userId,
      items: [item],
    });

    if (!verified) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Public-safe projection: beforeSummary/afterSummary require a dedicated
    // user_visible movement projection before inspector may expose them.
    return NextResponse.json({ item: verified });
  } catch (error) {
    console.error("[WHAT_CHANGED_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
