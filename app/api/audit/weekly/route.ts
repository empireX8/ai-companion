import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { buildWeeklyAudit } from "@/lib/weekly-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const latestAudit = await prismadb.weeklyAudit.findFirst({
      where: { userId },
      orderBy: { weekStart: "desc" },
    });

    if (latestAudit) {
      return NextResponse.json(latestAudit, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    const preview = await buildWeeklyAudit(userId);
    return NextResponse.json(
      {
        ...preview,
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
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
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
    console.log("[WEEKLY_AUDIT_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
