import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { isCanonicalModelAuthorityError } from "../../../../lib/canonical-model-authority-errors";
import { readCanonicalAndLegacyMovementList } from "../../../../lib/canonical-movement-list-merge";
import prismadb from "../../../../lib/prismadb";
import {
  getWindowStartDate,
  resolveTimelineWindow,
} from "../../../../lib/timeline-aggregation";
import { TIMELINE_MODEL_LAYERS_LIMIT } from "../../../../lib/timeline-model-layers";
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
    const { items } = await readCanonicalAndLegacyMovementList({
      userId,
      db: prismadb,
      limit: TIMELINE_MODEL_LAYERS_LIMIT,
      createdAtGte: windowStart,
    });

    const verifiedItems = await applyVerifiedAffectedObjectHrefs({
      userId,
      items,
    });

    return NextResponse.json({ items: verifiedItems });
  } catch (error) {
    if (
      isCanonicalModelAuthorityError(error) &&
      error.code === "BROKEN_CANONICAL_PROJECTION"
    ) {
      console.error("[TIMELINE_MODEL_LAYERS_GET]", { code: error.code });
      return NextResponse.json(
        { error: "Canonical model unavailable", code: "canonical_model_unavailable" },
        { status: 500 },
      );
    }
    console.error("[TIMELINE_MODEL_LAYERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
