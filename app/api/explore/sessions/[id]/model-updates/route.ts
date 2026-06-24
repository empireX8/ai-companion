import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { listExploreSessionPublishedModelUpdates } from "../../../../../../lib/explore-session-model-updates-server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sessionId = id.trim();

  if (!sessionId || !UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const items = await listExploreSessionPublishedModelUpdates({
      userId,
      sessionId,
    });

    if (items === "session_not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[EXPLORE_SESSION_MODEL_UPDATES_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
