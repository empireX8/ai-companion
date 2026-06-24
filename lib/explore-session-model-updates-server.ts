import "server-only";

import {
  ModelUpdateVisibility,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "@/lib/prismadb";
import { applyVerifiedAffectedObjectHrefs } from "./public-linked-object-continuity";
import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";

export const EXPLORE_SESSION_MODEL_UPDATES_LIMIT = 3;

const MODEL_UPDATE_PUBLIC_SELECT = {
  id: true,
  updateType: true,
  affectedObjectType: true,
  affectedObjectId: true,
  userFacingSummary: true,
  createdAt: true,
} as const;

export async function listExploreSessionPublishedModelUpdates(args: {
  userId: string;
  sessionId: string;
  limit?: number;
}): Promise<WhatChangedListItem[] | "session_not_found"> {
  const limit = args.limit ?? EXPLORE_SESSION_MODEL_UPDATES_LIMIT;

  const session = await prismadb.session.findFirst({
    where: {
      id: args.sessionId,
      userId: args.userId,
      surfaceType: "explore_chat",
    },
    select: { id: true },
  });

  if (!session) {
    return "session_not_found";
  }

  const messages = await prismadb.message.findMany({
    where: {
      sessionId: args.sessionId,
      userId: args.userId,
    },
    select: { id: true },
  });

  const messageIds = messages.map((message) => message.id);

  const sourceFilters: Array<{
    sourceType: UnderstandingLinkSourceType;
    sourceId: string | { in: string[] };
  }> = [
    {
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.sessionId,
    },
  ];

  if (messageIds.length > 0) {
    sourceFilters.push({
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: { in: messageIds },
    });
  }

  const evidenceLinks = await prismadb.understandingEvidenceLink.findMany({
    where: {
      userId: args.userId,
      targetType: UnderstandingLinkTargetType.model_update,
      OR: sourceFilters,
    },
    select: { targetId: true },
  });

  const linkedModelUpdateIds = [
    ...new Set(
      evidenceLinks
        .map((link) => link.targetId.trim())
        .filter((id) => id.length > 0)
    ),
  ];

  if (linkedModelUpdateIds.length === 0) {
    return [];
  }

  const rows = await prismadb.modelUpdate.findMany({
    where: {
      userId: args.userId,
      id: { in: linkedModelUpdateIds },
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: MODEL_UPDATE_PUBLIC_SELECT,
  });

  const items = rows
    .map((row) => toWhatChangedListItem(row))
    .filter((item): item is WhatChangedListItem => Boolean(item));

  return applyVerifiedAffectedObjectHrefs({
    userId: args.userId,
    items,
  });
}
