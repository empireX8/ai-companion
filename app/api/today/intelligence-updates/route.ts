import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { isCanonicalModelAuthorityError } from "../../../../lib/canonical-model-authority-errors";
import { readCanonicalAndLegacyMovementList } from "../../../../lib/canonical-movement-list-merge";
import prismadb from "../../../../lib/prismadb";
import { TODAY_INTELLIGENCE_UPDATES_LIMIT } from "../../../../lib/today-intelligence-updates";
import { applyVerifiedAffectedObjectHrefs } from "../../../../lib/public-linked-object-continuity";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { items } = await readCanonicalAndLegacyMovementList({
      userId,
      db: prismadb,
      limit: TODAY_INTELLIGENCE_UPDATES_LIMIT,
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
      console.error("[TODAY_INTELLIGENCE_UPDATES_GET]", { code: error.code });
      return NextResponse.json(
        { error: "Canonical model unavailable", code: "canonical_model_unavailable" },
        { status: 500 },
      );
    }
    console.error("[TODAY_INTELLIGENCE_UPDATES_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
