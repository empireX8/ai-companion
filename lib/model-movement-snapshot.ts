import {
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import {
  decodeMovementRationaleFromInternalNotes,
  encodeMovementRationaleInInternalNotes,
} from "./model-movement-rationale";
import { createResolveStoredSurfacingRationaleForModelUpdatePublish } from "./live-evidence-depth-rationale-source";

export type AffectedObjectStateSnapshot = {
  summary: string | null;
  title: string | null;
};

export type ModelMovementSnapshotPair = {
  beforeSummary: string | null;
  afterSummary: string | null;
};

export type MaterializeModelMovementSnapshotResult = ModelMovementSnapshotPair & {
  updated: boolean;
  movementRationale: string | null;
};

type SnapshotDb = Pick<
  PrismaClient,
  | "modelUpdate"
  | "userMapConclusion"
  | "patternClaim"
  | "investigation"
  | "fieldworkAssignment"
  | "contradictionNode"
  | "evidencePointerSurfacingRationale"
>;

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function formatSnapshotLabel(title: string | null, summary: string | null): string | null {
  const titleText = title?.trim();
  const summaryText = summary?.trim();

  if (titleText && summaryText && titleText !== summaryText) {
    return `${titleText} — ${summaryText}`;
  }

  return titleText ?? summaryText ?? null;
}

export async function resolveAffectedObjectStateSnapshot(args: {
  userId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  db: SnapshotDb;
}): Promise<AffectedObjectStateSnapshot> {
  const { userId, affectedObjectType, affectedObjectId, db } = args;

  switch (affectedObjectType) {
    case UnderstandingLinkTargetType.usermap_conclusion: {
      const row = await db.userMapConclusion.findFirst({
        where: { id: affectedObjectId, userId },
        select: { title: true, summary: true },
      });
      return {
        title: row?.title ?? null,
        summary: formatSnapshotLabel(row?.title ?? null, row?.summary ?? null),
      };
    }
    case UnderstandingLinkTargetType.pattern_claim: {
      const row = await db.patternClaim.findFirst({
        where: { id: affectedObjectId, userId },
        select: { summary: true },
      });
      return {
        title: row?.summary ?? null,
        summary: row?.summary?.trim() ?? null,
      };
    }
    case UnderstandingLinkTargetType.investigation: {
      const row = await db.investigation.findFirst({
        where: { id: affectedObjectId, userId },
        select: { title: true, organizingQuestion: true, resolutionSummary: true },
      });
      return {
        title: row?.title ?? null,
        summary: formatSnapshotLabel(
          row?.title ?? null,
          row?.resolutionSummary?.trim() || row?.organizingQuestion?.trim() || null,
        ),
      };
    }
    case UnderstandingLinkTargetType.fieldwork_assignment: {
      const row = await db.fieldworkAssignment.findFirst({
        where: { id: affectedObjectId, userId },
        select: { prompt: true, reason: true, observationNote: true },
      });
      return {
        title: row?.prompt ?? null,
        summary: formatSnapshotLabel(
          row?.prompt ?? null,
          row?.observationNote?.trim() || row?.reason?.trim() || null,
        ),
      };
    }
    case UnderstandingLinkTargetType.contradiction_node: {
      const row = await db.contradictionNode.findFirst({
        where: { id: affectedObjectId, userId },
        select: { title: true, sideA: true, sideB: true },
      });
      return {
        title: row?.title ?? null,
        summary: formatSnapshotLabel(
          row?.title ?? null,
          row?.sideA?.trim() && row?.sideB?.trim()
            ? `${row.sideA.trim()} vs ${row.sideB.trim()}`
            : null,
        ),
      };
    }
    default:
      return { title: null, summary: null };
  }
}

export function resolveConclusionAddedSnapshotPair(args: {
  conclusionTitle: string;
  conclusionSummary?: string | null;
}): ModelMovementSnapshotPair {
  return {
    beforeSummary: "No prior published conclusion on this map item.",
    afterSummary: formatSnapshotLabel(
      args.conclusionTitle,
      args.conclusionSummary?.trim() ?? null,
    ),
  };
}

export async function materializePublishedModelUpdateSnapshots(args: {
  userId: string;
  modelUpdateId: string;
  db: SnapshotDb;
  movementRationale?: string | null;
  force?: boolean;
}): Promise<MaterializeModelMovementSnapshotResult> {
  const row = await args.db.modelUpdate.findFirst({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
    },
    select: {
      id: true,
      affectedObjectType: true,
      affectedObjectId: true,
      beforeSummary: true,
      afterSummary: true,
      internalNotes: true,
      visibility: true,
    },
  });

  if (!row) {
    return {
      beforeSummary: null,
      afterSummary: null,
      movementRationale: null,
      updated: false,
    };
  }

  const currentState = await resolveAffectedObjectStateSnapshot({
    userId: args.userId,
    affectedObjectType: row.affectedObjectType,
    affectedObjectId: row.affectedObjectId,
    db: args.db,
  });

  const nextBefore = row.beforeSummary ?? null;
  const nextAfter = row.afterSummary ?? currentState.summary ?? null;

  const shouldWriteBefore = args.force || !hasText(row.beforeSummary);
  const shouldWriteAfter = args.force || !hasText(row.afterSummary);

  const data: {
    beforeSummary?: string | null;
    afterSummary?: string | null;
    internalNotes?: string;
  } = {};

  if (shouldWriteBefore && hasText(nextBefore)) {
    data.beforeSummary = nextBefore;
  } else if (shouldWriteBefore && !hasText(row.beforeSummary)) {
    data.beforeSummary = null;
  }

  if (shouldWriteAfter) {
    data.afterSummary = nextAfter;
  }

  if (hasText(args.movementRationale)) {
    const currentRationale = decodeMovementRationaleFromInternalNotes(row.internalNotes);
    if (currentRationale?.trim() !== args.movementRationale!.trim()) {
      data.internalNotes = encodeMovementRationaleInInternalNotes(
        row.internalNotes,
        args.movementRationale!,
      );
    }
  }

  const updatedFields = Object.keys(data);
  if (updatedFields.length === 0) {
    return {
      beforeSummary: row.beforeSummary,
      afterSummary: row.afterSummary,
      movementRationale: decodeMovementRationaleFromInternalNotes(row.internalNotes),
      updated: false,
    };
  }

  await args.db.modelUpdate.updateMany({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
    },
    data,
  });

  const refreshed = await args.db.modelUpdate.findFirst({
    where: { id: args.modelUpdateId, userId: args.userId },
    select: {
      beforeSummary: true,
      afterSummary: true,
      internalNotes: true,
    },
  });

  return {
    beforeSummary: refreshed?.beforeSummary ?? row.beforeSummary,
    afterSummary: refreshed?.afterSummary ?? row.afterSummary,
    movementRationale: decodeMovementRationaleFromInternalNotes(refreshed?.internalNotes),
    updated: true,
  };
}

export async function captureBeforeSnapshotForCandidate(args: {
  userId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  db: SnapshotDb;
}): Promise<string | null> {
  const snapshot = await resolveAffectedObjectStateSnapshot(args);
  return snapshot.summary;
}

export async function listVisibleModelMovementDepthRows(args: {
  userId: string;
  db: SnapshotDb;
  ids?: string[];
  limit?: number;
}): Promise<
  Array<{
    id: string;
    before: string | null;
    after: string | null;
    movementSummary: string;
    movementRationale: string | null;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectId: string;
    createdAt: Date;
    evidenceLinkCount: number;
  }>
> {
  const limit = args.limit ?? 10;
  const rows = await args.db.modelUpdate.findMany({
    where: {
      userId: args.userId,
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
      ...(args.ids?.length ? { id: { in: args.ids } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      affectedObjectType: true,
      affectedObjectId: true,
      userFacingSummary: true,
      beforeSummary: true,
      afterSummary: true,
      internalNotes: true,
      createdAt: true,
    },
  });

  const linkDb = args.db as PrismaClient;
  const linkCounts = await Promise.all(
    rows.map((row) =>
      linkDb.understandingEvidenceLink.count({
        where: {
          userId: args.userId,
          targetType: UnderstandingLinkTargetType.model_update,
          targetId: row.id,
        },
      }),
    ),
  );

  return rows.map((row, index) => ({
    id: row.id,
    before: row.beforeSummary,
    after: row.afterSummary,
    movementSummary: row.userFacingSummary,
    movementRationale: decodeMovementRationaleFromInternalNotes(row.internalNotes),
    affectedObjectType: row.affectedObjectType,
    affectedObjectId: row.affectedObjectId,
    createdAt: row.createdAt,
    evidenceLinkCount: linkCounts[index] ?? 0,
  }));
}

export async function resolveMovementRationaleForPublishedModelUpdate(args: {
  userId: string;
  modelUpdateId: string;
  db: Pick<PrismaClient, "modelUpdate" | "evidencePointerSurfacingRationale">;
}): Promise<string | null> {
  const row = await args.db.modelUpdate.findFirst({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
    },
    select: {
      internalNotes: true,
      affectedObjectType: true,
      affectedObjectId: true,
    },
  });

  if (!row) {
    return null;
  }

  const existing = decodeMovementRationaleFromInternalNotes(row.internalNotes);
  if (existing) {
    return existing;
  }

  const resolveStored = createResolveStoredSurfacingRationaleForModelUpdatePublish({
    db: args.db,
  });

  return resolveStored({
    input: {
      userId: args.userId,
      affectedObjectType: row.affectedObjectType,
      affectedObjectId: row.affectedObjectId,
    },
  });
}
