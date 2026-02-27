import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { computeAuditExplain } from "@/lib/weekly-audit-explain";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const audit = await prismadb.weeklyAudit.findUnique({
      where: { id },
      select: {
        userId: true,
        contradictionDensity: true,
        stabilityProxy: true,
        top3AvgComputedWeight: true,
        totalAvoidanceCount: true,
        totalSnoozeCount: true,
        status: true,
      },
    });

    if (!audit || audit.userId !== userId) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(computeAuditExplain(audit));
  } catch (error) {
    console.log("[WEEKLY_AUDIT_EXPLAIN_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
