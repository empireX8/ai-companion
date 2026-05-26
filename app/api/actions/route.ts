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
import {
  loadEligibleActionRankingDiagnosticsForUser,
  simulateActionRankingWithDiagnostics,
} from "../../../lib/actions-feedback";
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

  const searchParams = req ? new URL(req.url).searchParams : null;
  const includeUnderstandingLinks = searchParams
    ? isIncludeUnderstandingLinksEnabled(searchParams)
    : false;
  const debugRankingParam = searchParams?.get("debugRanking");
  const debugRankingEnabled =
    debugRankingParam === "1" ||
    debugRankingParam?.toLowerCase() === "true";
  const simulateRankingParam = searchParams?.get("simulateRanking");
  const simulateRankingEnabled =
    debugRankingEnabled &&
    (simulateRankingParam === "1" ||
      simulateRankingParam?.toLowerCase() === "true");

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

  const payload = {
    currentPriority: buildCurrentPrioritySnapshot(visibleClaims, true),
    stabilizeNow,
    buildForward,
  };

  if (!debugRankingEnabled) {
    return NextResponse.json(payload);
  }

  const rankingDiagnostics = await loadEligibleActionRankingDiagnosticsForUser({
    userId,
    db: prismadb,
  });
  const actionRows = await prismadb.surfacedAction.findMany({
    where: {
      userId,
      id: { in: surfacedActions.map((action) => action.id) },
    },
    select: {
      id: true,
      templateId: true,
    },
  });
  const templateIdByActionId = new Map(
    actionRows.map((actionRow) => [actionRow.id, actionRow.templateId])
  );
  const simulationInputs = surfacedActions.map((action) => ({
    actionId: action.id,
    templateId: templateIdByActionId.get(action.id) ?? "__unknown_template__",
  }));
  const simulatedRankingPreview = simulateActionRankingWithDiagnostics(
    simulationInputs,
    rankingDiagnostics
  );

  if (!simulateRankingEnabled) {
    return NextResponse.json({
      ...payload,
      rankingMode: "default" as const,
      rankingDiagnostics,
      simulatedRankingPreview,
    });
  }

  const buildOrderMap = (
    preview: { actionId: string; simulatedIndex: number }[]
  ): Map<string, number> =>
    new Map(preview.map((item) => [item.actionId, item.simulatedIndex]));

  const reorderBucketByPreview = <T extends { id: string }>(
    actions: T[],
    orderByActionId: Map<string, number>
  ): T[] =>
    actions
      .map((action, index) => ({
        action,
        index,
        simulatedIndex: orderByActionId.get(action.id) ?? index,
      }))
      .sort((left, right) => {
        if (left.simulatedIndex !== right.simulatedIndex) {
          return left.simulatedIndex - right.simulatedIndex;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.action);

  const stabilizePreview = simulatedRankingPreview.filter(
    (item) => item.actionId && stabilizeNow.some((action) => action.id === item.actionId)
  );
  const buildPreview = simulatedRankingPreview.filter(
    (item) => item.actionId && buildForward.some((action) => action.id === item.actionId)
  );

  const simulatedStabilizeNow = reorderBucketByPreview(
    stabilizeNow,
    buildOrderMap(stabilizePreview)
  );
  const simulatedBuildForward = reorderBucketByPreview(
    buildForward,
    buildOrderMap(buildPreview)
  );

  return NextResponse.json({
    ...payload,
    rankingMode: "simulated_debug" as const,
    stabilizeNow: simulatedStabilizeNow,
    buildForward: simulatedBuildForward,
    rankingDiagnostics,
    simulatedRankingPreview,
  });
}
