import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UnderstandingLinkSourceType } from "@prisma/client";

import prismadb from "@/lib/prismadb";
import {
  buildCurrentPrioritySnapshot,
  selectBuildForwardActionBlueprints,
  selectStabilizeActionBlueprints,
  syncSurfacedActions,
  type VisibleGoalReference,
} from "@/lib/actions-v1";
import type { PatternClaimView } from "@/lib/patterns-api";
import { projectVisiblePatternClaim } from "@/lib/pattern-visible-claim";
import {
  buildRelatedUnderstandingBySourceId,
  isIncludeUnderstandingLinksEnabled,
} from "../../../lib/understanding-links";

export const dynamic = "force-dynamic";

export async function GET(req?: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeUnderstandingLinks = req
    ? isIncludeUnderstandingLinksEnabled(new URL(req.url).searchParams)
    : false;

  const [claims, goalRefs] = await Promise.all([
    prismadb.patternClaim.findMany({
      where: { userId },
      include: {
        evidence: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prismadb.referenceItem.findMany({
      where: {
        userId,
        type: "goal",
        status: "active",
      },
      select: {
        id: true,
        statement: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ]);

  const visibleClaims = claims.flatMap((claim) => {
    const projected = projectVisiblePatternClaim({
      id: claim.id,
      patternType: claim.patternType as PatternClaimView["patternType"],
      summary: claim.summary,
      status: claim.status as PatternClaimView["status"],
      strengthLevel: claim.strengthLevel as PatternClaimView["strengthLevel"],
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      journalEvidenceCount: claim.journalEvidenceCount,
      journalEntrySpread: claim.journalEntrySpread,
      journalDaySpread: claim.journalDaySpread,
      supportContainerSpread: claim.supportContainerSpread,
      evidence: claim.evidence,
      actions: [],
    });
    return projected ? [projected] : [];
  });
  const goals: VisibleGoalReference[] = goalRefs.map((goal) => ({
    id: goal.id,
    statement: goal.statement,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  }));

  const stabilizeBlueprints = selectStabilizeActionBlueprints(visibleClaims);
  const buildBlueprints = selectBuildForwardActionBlueprints(goals);
  const surfacedActions = await syncSurfacedActions(
    {
      userId,
      blueprints: [...stabilizeBlueprints, ...buildBlueprints],
    },
    prismadb
  );

  const relatedByActionId = includeUnderstandingLinks
    ? await buildRelatedUnderstandingBySourceId({
        userId,
        sourceType: UnderstandingLinkSourceType.surfaced_action,
        sourceIds: surfacedActions.map((action) => action.id),
      })
    : null;

  const stabilizeNow = surfacedActions
    .filter((action) => action.bucket === "stabilize")
    .map((action) =>
      includeUnderstandingLinks
        ? {
            ...action,
            relatedUnderstanding: relatedByActionId?.get(action.id),
          }
        : action
    );

  const buildForward = surfacedActions
    .filter((action) => action.bucket === "build")
    .map((action) =>
      includeUnderstandingLinks
        ? {
            ...action,
            relatedUnderstanding: relatedByActionId?.get(action.id),
          }
        : action
    );

  return NextResponse.json({
    currentPriority: buildCurrentPrioritySnapshot(visibleClaims, true),
    stabilizeNow,
    buildForward,
  });
}
