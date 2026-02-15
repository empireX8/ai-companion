import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { computeWeeklyAuditDeltas } from "@/lib/weekly-audit-trend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weeksParam = searchParams.get("weeks");
    const weeks = weeksParam ? Number(weeksParam) : 8;

    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      return new NextResponse("Invalid weeks value", { status: 400 });
    }

    const items = await prismadb.weeklyAudit.findMany({
      where: { userId },
      orderBy: { weekStart: "desc" },
      take: weeks,
    });

    const deltas = computeWeeklyAuditDeltas(items);

    return NextResponse.json(
      {
        weeks,
        items,
        deltas,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.log("[WEEKLY_AUDIT_TREND_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
