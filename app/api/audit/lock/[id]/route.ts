import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { buildWeeklyAudit, WeeklyAuditInvalidDataError } from "@/lib/weekly-audit";
import { computeWeeklyAuditHash } from "@/lib/weekly-audit-hash";
import { serverLogMetric } from "@/lib/metrics-server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let authedUserId = "";
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    authedUserId = userId;

    const { id } = await params;

    const audit = await prismadb.weeklyAudit.findFirst({
      where: { id, userId },
    });

    if (!audit) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Idempotent: if already locked return the existing row unchanged.
    if (audit.status === "locked") {
      return NextResponse.json(audit);
    }

    // Recompute metrics for that week from live data.
    const auditData = await buildWeeklyAudit(userId, audit.weekStart);

    const inputHash = computeWeeklyAuditHash({
      referenceCount: auditData.activeReferenceCount,
      contradictionCount: auditData.totalContradictionCount,
      openContradictionCount: auditData.openContradictionCount,
      resolvedCount: 0,
      salienceAggregate: auditData.top3AvgComputedWeight,
      escalationCount: auditData.totalAvoidanceCount,
      artifactCounts: {},
    });

    const now = new Date();

    const locked = await prismadb.$transaction(async (tx) => {
      return tx.weeklyAudit.update({
        where: { id: audit.id },
        data: {
          // Sealed metrics snapshot
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
          // Locking fields
          status: "locked",
          lockedAt: now,
          inputHash,
        },
      });
    });

    return NextResponse.json(locked);
  } catch (error) {
    if (error instanceof WeeklyAuditInvalidDataError) {
      void serverLogMetric({
        userId: authedUserId,
        name: "invariant.violation",
        level: "warn",
        meta: { code: error.code, route: "/api/audit/lock/[id]", message: error.message },
        source: "server",
        route: "/api/audit/lock/[id]",
      });
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 }
      );
    }
    console.log("[AUDIT_LOCK_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
