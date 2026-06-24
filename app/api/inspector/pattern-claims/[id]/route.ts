import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PatternClaimStatus } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { projectVisiblePatternClaim } from "@/lib/pattern-visible-claim";

export const dynamic = "force-dynamic";

const VISIBLE_PATTERN_STATUSES: PatternClaimStatus[] = ["active", "paused"];

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
    const claim = await prismadb.patternClaim.findFirst({
      where: {
        id,
        userId,
        status: { in: VISIBLE_PATTERN_STATUSES },
      },
      include: {
        evidence: {
          orderBy: { createdAt: "desc" },
        },
        actions: {
          where: { status: { in: ["pending", "in_progress"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = projectVisiblePatternClaim(claim);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[INSPECTOR_PATTERN_CLAIM_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
