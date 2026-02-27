import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { computeWeeklyAuditDiff, summarizeWeeklyAuditDiff } from "@/lib/weekly-audit-diff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromId = searchParams.get("from");
    const toId = searchParams.get("to");

    if (!fromId || !toId) {
      return new NextResponse("Missing from or to parameter", { status: 400 });
    }

    const [fromAudit, toAudit] = await Promise.all([
      prismadb.weeklyAudit.findUnique({ where: { id: fromId } }),
      prismadb.weeklyAudit.findUnique({ where: { id: toId } }),
    ]);

    if (
      !fromAudit ||
      fromAudit.userId !== userId ||
      !toAudit ||
      toAudit.userId !== userId
    ) {
      return new NextResponse("Not found", { status: 404 });
    }

    const diff = computeWeeklyAuditDiff(fromAudit, toAudit);
    const summary = summarizeWeeklyAuditDiff(diff);

    return NextResponse.json({ from: fromAudit, to: toAudit, diff, summary });
  } catch (error) {
    console.log("[WEEKLY_AUDIT_COMPARE_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
