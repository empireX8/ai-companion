import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getExploreConversationReviewItems } from "@/lib/explore-conversation-review";

export const dynamic = "force-dynamic";

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
    const result = await getExploreConversationReviewItems({
      userId,
      sessionId: id,
    });

    if (!result.sessionFound) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      items: result.items,
      sourceAvailable: result.sourceAvailable,
    });
  } catch (error) {
    console.error("[EXPLORE_SESSION_REVIEW_ITEMS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
