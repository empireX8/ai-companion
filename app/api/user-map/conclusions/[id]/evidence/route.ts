import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { enrichContinuityItemsForInspector } from "../../../../../../lib/inspector-evidence-links";
import { listYourMapPublicEvidenceContinuity } from "../../../../../../lib/public-evidence-continuity";

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
    const target = await prismadb.userMapConclusion.findFirst({
      where: {
        id,
        userId,
        visibility: UserMapConclusionVisibility.user_visible,
      },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const continuityItems = await listYourMapPublicEvidenceContinuity({
      userId,
      targetId: target.id,
    });

    const items = await enrichContinuityItemsForInspector({
      userId,
      items: continuityItems,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[USER_MAP_CONCLUSION_EVIDENCE_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
