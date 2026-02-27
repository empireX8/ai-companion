import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  addWeeks,
  ensureWeeklyAuditForWeekStart,
  getWeekStart,
  WeeklyAuditLockedError,
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
    const skippedExistingWeekStarts: string[] = [];
    const skippedLockedWeekStarts: string[] = [];
    const errors: string[] = [];

    for (let index = 0; index < weeks; index += 1) {
      const targetNow = addWeeks(now, -index);
      const weekStartIso = getWeekStart(targetNow).toISOString();

      try {
        const ensured = await ensureWeeklyAuditForWeekStart(userId, targetNow);
        if (ensured.created) {
          createdWeekStarts.push(weekStartIso);
        } else {
          skippedExistingWeekStarts.push(weekStartIso);
        }
      } catch (e) {
        if (e instanceof WeeklyAuditLockedError) {
          skippedLockedWeekStarts.push(weekStartIso);
        } else {
          errors.push(
            `${weekStartIso}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }

    return NextResponse.json(
      {
        weeksRequested: weeks,
        weeksConsidered: weeks,
        createdCount: createdWeekStarts.length,
        skippedExistingCount: skippedExistingWeekStarts.length,
        skippedLockedCount: skippedLockedWeekStarts.length,
        createdWeekStarts,
        skippedExistingWeekStarts,
        skippedLockedWeekStarts,
        errors,
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
