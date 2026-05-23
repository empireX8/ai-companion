import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UnderstandingLinkTargetType } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES } from "../../../../../lib/active-questions";
import { listPublicEvidenceContinuityForTarget } from "../../../../../lib/public-evidence-continuity";

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
    const target = await prismadb.investigation.findFirst({
      where: {
        id,
        userId,
        status: { in: ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES },
      },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const continuityItems = await listPublicEvidenceContinuityForTarget({
      userId,
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: target.id,
    });

    const items = continuityItems.map((item) => ({
      sourceTypeLabel: item.sourceTypeLabel,
      sourceObjectHref: item.href,
      createdAt: item.createdAt,
      hasEvidence: true as const,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[ACTIVE_QUESTION_EVIDENCE_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
