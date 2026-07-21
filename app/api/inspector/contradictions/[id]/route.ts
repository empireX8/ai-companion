import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ContradictionStatus } from "@prisma/client";

import {
  createPrismaDualSourcePresentationReader,
  resolveContradictionDualSourcePresentation,
} from "@/lib/contradiction-dual-source-presentation";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const PUBLIC_CONTRADICTION_STATUSES: ContradictionStatus[] = [
  "open",
  "explored",
  "snoozed",
  "resolved",
  "accepted_tradeoff",
  "archived_tension",
];

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
    const row = await prismadb.contradictionNode.findFirst({
      where: {
        id,
        userId,
        status: { in: PUBLIC_CONTRADICTION_STATUSES },
      },
      select: {
        id: true,
        title: true,
        sideA: true,
        sideB: true,
        status: true,
        evidenceCount: true,
        lastEvidenceAt: true,
        lastTouchedAt: true,
        sideASourceSpanId: true,
        sideBSourceSpanId: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const dualSource = await resolveContradictionDualSourcePresentation({
      userId,
      node: {
        id: row.id,
        sideASourceSpanId: row.sideASourceSpanId,
        sideBSourceSpanId: row.sideBSourceSpanId,
      },
      reader: createPrismaDualSourcePresentationReader(prismadb),
    });

    return NextResponse.json({
      item: {
        id: row.id,
        title: row.title,
        sideA: row.sideA,
        sideB: row.sideB,
        status: row.status,
        evidenceCount: row.evidenceCount,
        lastEvidenceAt: row.lastEvidenceAt?.toISOString() ?? null,
        lastTouchedAt: row.lastTouchedAt.toISOString(),
        dualSource,
      },
    });
  } catch (error) {
    console.error("[INSPECTOR_CONTRADICTION_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
