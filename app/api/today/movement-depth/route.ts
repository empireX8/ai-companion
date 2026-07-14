import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import {
  buildModelMovementDepthIndex,
  type ModelMovementDepthRecord,
} from "../../../../lib/model-movement-report-contract";
import { decodeMovementRationaleFromInternalNotes } from "../../../../lib/model-movement-rationale";
import { applyVerifiedAffectedObjectHrefs } from "../../../../lib/public-linked-object-continuity";
import {
  formatLinkedObjectType,
  toWhatChangedListItem,
} from "../../../../lib/public-intelligence-safe-slice";
import { TODAY_MOVEMENT_DEPTH_LIMIT } from "../../../../lib/today-movement-depth";
import prismadb from "../../../../lib/prismadb";

export const dynamic = "force-dynamic";

/**
 * Malformed or unknown ids: returns HTTP 200 with empty items — never cross-user rows.
 * Auth is required; all queries are scoped to the authenticated userId.
 */
function parseIdsParam(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, TODAY_MOVEMENT_DEPTH_LIMIT);
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ids = parseIdsParam(searchParams.get("ids"));

  try {
    const rows = await prismadb.modelUpdate.findMany({
      where: {
        userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
        ...(ids.length ? { id: { in: ids } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TODAY_MOVEMENT_DEPTH_LIMIT,
      select: {
        id: true,
        updateType: true,
        affectedObjectType: true,
        affectedObjectId: true,
        userFacingSummary: true,
        beforeSummary: true,
        afterSummary: true,
        internalNotes: true,
        createdAt: true,
      },
    });

    const listItems = rows
      .map((row) => toWhatChangedListItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const verifiedItems = await applyVerifiedAffectedObjectHrefs({
      userId,
      items: listItems,
    });
    const verifiedById = new Map(verifiedItems.map((item) => [item.id, item]));

    const linkCounts = await Promise.all(
      rows.map((row) =>
        prismadb.understandingEvidenceLink.count({
          where: {
            userId,
            targetType: "model_update",
            targetId: row.id,
          },
        }),
      ),
    );

    const linksByTarget =
      rows.length === 0
        ? []
        : await prismadb.understandingEvidenceLink.findMany({
            where: {
              userId,
              targetType: "model_update",
              targetId: { in: rows.map((row) => row.id) },
            },
            select: {
              targetId: true,
              summary: true,
            },
            orderBy: { createdAt: "asc" },
          });

    const quotesByTarget = new Map<string, string[]>();
    for (const link of linksByTarget) {
      const quote = link.summary?.trim();
      if (!quote) {
        continue;
      }
      const existing = quotesByTarget.get(link.targetId) ?? [];
      if (!existing.includes(quote)) {
        existing.push(quote);
      }
      quotesByTarget.set(link.targetId, existing);
    }

    const items: ModelMovementDepthRecord[] = rows.map((row, index) => {
      const verified = verifiedById.get(row.id);
      return {
        id: row.id,
        before: row.beforeSummary,
        after: row.afterSummary,
        movementSummary: row.userFacingSummary,
        movementRationale: decodeMovementRationaleFromInternalNotes(row.internalNotes),
        affectedObjectType: row.affectedObjectType,
        affectedObjectId: row.affectedObjectId,
        affectedObjectTypeLabel:
          verified?.affectedObjectTypeLabel ??
          formatLinkedObjectType(row.affectedObjectType),
        affectedObjectHref: verified?.affectedObjectHref ?? null,
        createdAt: row.createdAt.toISOString(),
        evidenceLinkCount: linkCounts[index] ?? 0,
        evidenceQuotes: quotesByTarget.get(row.id) ?? [],
      };
    });

    return NextResponse.json({
      items,
      index: buildModelMovementDepthIndex(items),
    });
  } catch (error) {
    console.error("[TODAY_MOVEMENT_DEPTH_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
