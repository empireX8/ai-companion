import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  buildWeeklyAudit,
  getWeekStart,
  WeeklyAuditInvalidDataError,
  WeeklyAuditLockedError,
} from "@/lib/weekly-audit";
import { serverLogMetric } from "@/lib/metrics-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const weekStart = getWeekStart(new Date());
    const storedAudit = await prismadb.weeklyAudit.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    if (storedAudit) {
      return NextResponse.json(storedAudit, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    const preview = await buildWeeklyAudit(userId);
    return NextResponse.json(
      {
        ...preview,
        status: "draft",
        preview: true,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.log("[WEEKLY_AUDIT_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST() {
  let authedUserId = "";
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    authedUserId = userId;

    // Fast lock check before expensive audit build.
    const weekStart = getWeekStart(new Date());
    const existing = await prismadb.weeklyAudit.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    if (existing?.status === "locked") {
      // Idempotent: snapshot already exists as a locked record — return it.
      return NextResponse.json(existing, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    const auditData = await buildWeeklyAudit(userId);

    const savedAudit = await prismadb.weeklyAudit.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart: auditData.weekStart,
        },
      },
      create: auditData,
      update: {
        generatedAt: new Date(),
        activeReferenceCount: auditData.activeReferenceCount,
        openContradictionCount: auditData.openContradictionCount,
        totalContradictionCount: auditData.totalContradictionCount,
        top3AvgComputedWeight: auditData.top3AvgComputedWeight,
        top3Ids: auditData.top3Ids,
        totalAvoidanceCount: auditData.totalAvoidanceCount,
        totalSnoozeCount: auditData.totalSnoozeCount,
        contradictionDensity: auditData.contradictionDensity,
        stabilityProxy: auditData.stabilityProxy,
        top3Snapshot: auditData.top3Snapshot,
      },
    });

    return NextResponse.json(savedAudit);
  } catch (error) {
    if (error instanceof WeeklyAuditInvalidDataError) {
      void serverLogMetric({
        userId: authedUserId,
        name: "invariant.violation",
        level: "warn",
        meta: { code: error.code, route: "/api/audit/weekly", message: error.message },
        source: "server",
        route: "/api/audit/weekly",
      });
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 }
      );
    }
    if (error instanceof WeeklyAuditLockedError) {
      // Defensive: shouldn't reach here due to early check above.
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 }
      );
    }
    console.log("[WEEKLY_AUDIT_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
