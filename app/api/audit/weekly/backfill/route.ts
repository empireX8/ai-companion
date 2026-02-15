import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  addWeeks,
  ensureWeeklyAuditForWeekStart,
  getWeekStart,
} from "@/lib/weekly-audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weeksParam = searchParams.get("weeks");
    const weeks = weeksParam ? Number(weeksParam) : 12;

    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      return new NextResponse("Invalid weeks value", { status: 400 });
    }

    const now = new Date();
    const createdWeekStarts: string[] = [];
    const skippedWeekStarts: string[] = [];

    for (let index = 0; index < weeks; index += 1) {
      const targetNow = addWeeks(now, -index);
      const ensured = await ensureWeeklyAuditForWeekStart(userId, targetNow);
      const weekStartIso = getWeekStart(targetNow).toISOString();

      if (ensured.created) {
        createdWeekStarts.push(weekStartIso);
      } else {
        skippedWeekStarts.push(weekStartIso);
      }
    }

    return NextResponse.json(
      {
        weeksRequested: weeks,
        weeksConsidered: weeks,
        created: createdWeekStarts.length,
        skipped: skippedWeekStarts.length,
        createdWeekStarts,
        skippedWeekStarts,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.log("[WEEKLY_AUDIT_BACKFILL_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
