import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

const DETAIL_SELECT = {
  id: true,
  type: true,
  confidence: true,
  statement: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  supersedesId: true,
  sourceMessageId: true,
} as const;

export type ReferenceDetailItem = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  supersedesId: string | null;
  sourceMessageId: string | null;
  /** First EvidenceSpan ID for the sourceMessage, if one exists. */
  spanId: string | null;
};

export type ReferenceDetailResult = {
  current: ReferenceDetailItem;
  previousVersion: ReferenceDetailItem | null;
  nextVersions: ReferenceDetailItem[];
};

export class ReferenceDetailNotFoundError extends Error {
  status = 404;
  code = "REFERENCE_NOT_FOUND";

  constructor() {
    super("Reference not found");
  }
}

/**
 * Fetch the detail for a single reference plus one hop of supersession chain.
 *
 * Data direction: when an item is superseded, the OLD record gets
 * `supersedesId = newItem.id` (forward pointer to its replacement).
 *
 * - `previousVersion`:  the older record that was replaced to produce `current`
 *                       → items where `supersedesId = current.id`
 * - `nextVersions`:     the newer record(s) that replaced `current`
 *                       → item at `current.supersedesId` (at most one)
 */
export async function getReferenceDetail({
  userId,
  referenceId,
  db = prismadb,
}: {
  userId: string;
  referenceId: string;
  db?: PrismaClient;
}): Promise<ReferenceDetailResult> {
  const current = await db.referenceItem.findFirst({
    where: { id: referenceId, userId },
    select: DETAIL_SELECT,
  });

  if (!current) {
    throw new ReferenceDetailNotFoundError();
  }

  // Look up EvidenceSpan for the source message (citation backbone)
  let spanId: string | null = null;
  if (current.sourceMessageId) {
    const span = await db.evidenceSpan.findFirst({
      where: { messageId: current.sourceMessageId, userId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    spanId = span?.id ?? null;
  }

  // Older item that was superseded to produce the current one
  const previousVersion = await db.referenceItem.findFirst({
    where: { supersedesId: referenceId, userId },
    select: DETAIL_SELECT,
    orderBy: { createdAt: "desc" },
  });

  // Newer item that replaced the current one (follows forward pointer)
  const nextVersions: ReferenceDetailItem[] = [];
  if (current.supersedesId) {
    const next = await db.referenceItem.findFirst({
      where: { id: current.supersedesId, userId },
      select: DETAIL_SELECT,
    });
    if (next) nextVersions.push({ ...next, spanId: null });
  }

  return {
    current: { ...current, spanId },
    previousVersion: previousVersion ? { ...previousVersion, spanId: null } : null,
    nextVersions,
  };
}
