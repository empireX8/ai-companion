/**
 * Authority-safe movement list reader for Today and Timeline.
 *
 * One PostgreSQL REPEATABLE READ transaction:
 * 1) canonical model projection (transaction-scoped Phase 4 helper)
 * 2) collect exact canonical ModelUpdate IDs
 * 3) query only legacy ModelUpdates not represented canonically
 * 4) keep typed branches, merge, globally sort, then apply limit
 */

import {
  ModelUpdateVisibility,
  Prisma,
  UnderstandingLinkTargetType,
  type ModelUpdateType,
  type PrismaClient,
} from "@prisma/client";

import {
  collectCanonicalMovementModelUpdateIds,
  flattenCanonicalMovementsForLists,
  toCanonicalProductAuthoritySnapshotV1,
  type CanonicalMovementListRow,
  type CanonicalProductConceptV1,
} from "./canonical-model-product-projection";
import {
  readCanonicalModelProjectionInTransaction,
  type ProjectionTx,
} from "./canonical-model-projection";
import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";

export type CanonicalMovementServiceItem = WhatChangedListItem & {
  authorityType: "canonical_movement";
  conceptId: string;
  previousRevisionId: string;
  resultingRevisionId: string;
  beforeSummary: string;
  afterSummary: string;
  modelUpdateId: string;
};

export type LegacyMovementServiceItem = WhatChangedListItem & {
  authorityType: "legacy_model_update";
};

export type MovementListServiceItem =
  | CanonicalMovementServiceItem
  | LegacyMovementServiceItem;

function compareMovementRows(
  a: { createdAt: string | Date; id: string },
  b: { createdAt: string | Date; id: string },
): number {
  const at =
    typeof a.createdAt === "string"
      ? new Date(a.createdAt).getTime()
      : a.createdAt.getTime();
  const bt =
    typeof b.createdAt === "string"
      ? new Date(b.createdAt).getTime()
      : b.createdAt.getTime();
  if (at !== bt) return bt - at;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function toCanonicalServiceItem(
  row: CanonicalMovementListRow,
): CanonicalMovementServiceItem | null {
  const base = toWhatChangedListItem({
    id: row.id,
    updateType: row.updateType,
    affectedObjectType: UnderstandingLinkTargetType.canonical_concept_revision,
    affectedObjectId: row.affectedObjectId,
    userFacingSummary: row.userFacingSummary,
    createdAt: row.createdAt,
  });
  if (!base) return null;
  return {
    ...base,
    authorityType: "canonical_movement",
    conceptId: row.conceptId,
    previousRevisionId: row.previousRevisionId,
    resultingRevisionId: row.resultingRevisionId,
    beforeSummary: row.beforeSummary,
    afterSummary: row.afterSummary,
    modelUpdateId: row.id,
  };
}

function toLegacyServiceItem(args: {
  id: string;
  updateType: ModelUpdateType;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  createdAt: Date;
}): LegacyMovementServiceItem | null {
  const base = toWhatChangedListItem(args);
  if (!base) return null;
  return {
    ...base,
    authorityType: "legacy_model_update",
  };
}

export function mergeCanonicalAndLegacyMovementServiceItems(args: {
  canonicalItems: CanonicalMovementServiceItem[];
  legacyItems: LegacyMovementServiceItem[];
  limit: number;
}): MovementListServiceItem[] {
  const suppress = new Set(args.canonicalItems.map((item) => item.id));
  const legacyFiltered = args.legacyItems.filter((item) => !suppress.has(item.id));
  return [...args.canonicalItems, ...legacyFiltered]
    .sort(compareMovementRows)
    .slice(0, args.limit);
}

/** @deprecated Prefer readCanonicalAndLegacyMovementList — kept for unit merge proofs. */
export function mergeCanonicalAndLegacyMovementListItems(args: {
  canonicalConcepts: CanonicalProductConceptV1[];
  legacyItems: WhatChangedListItem[];
  limit: number;
}): WhatChangedListItem[] {
  const canonicalRows = flattenCanonicalMovementsForLists(args.canonicalConcepts);
  const canonicalItems = canonicalRows
    .map(toCanonicalServiceItem)
    .filter((item): item is CanonicalMovementServiceItem => Boolean(item));
  const legacyItems = args.legacyItems
    .map((item) => ({
      ...item,
      authorityType: "legacy_model_update" as const,
    }))
    .filter((item) => Boolean(item.id));
  return mergeCanonicalAndLegacyMovementServiceItems({
    canonicalItems,
    legacyItems,
    limit: args.limit,
  });
}

export async function loadCanonicalProductConceptsForUser(args: {
  userId: string;
  db: PrismaClient;
}): Promise<CanonicalProductConceptV1[]> {
  const projection = await args.db.$transaction(
    async (tx) =>
      readCanonicalModelProjectionInTransaction({
        userId: args.userId,
        tx: tx as unknown as ProjectionTx,
      }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60_000,
    },
  );
  return projection.concepts.map((concept) =>
    toCanonicalProductAuthoritySnapshotV1(concept),
  );
}

export async function readCanonicalAndLegacyMovementList(args: {
  userId: string;
  db: PrismaClient;
  limit: number;
  createdAtGte?: Date;
  afterCanonicalLoaded?: () => Promise<void>;
}): Promise<{
  items: MovementListServiceItem[];
  canonicalConcepts: CanonicalProductConceptV1[];
}> {
  return args.db.$transaction(
    async (tx) => {
      const projection = await readCanonicalModelProjectionInTransaction({
        userId: args.userId,
        tx: tx as unknown as ProjectionTx,
      });
      if (args.afterCanonicalLoaded) {
        await args.afterCanonicalLoaded();
      }

      let productConcepts = projection.concepts.map((concept) =>
        toCanonicalProductAuthoritySnapshotV1(concept),
      );
      if (args.createdAtGte) {
        const windowStartMs = args.createdAtGte.getTime();
        productConcepts = productConcepts.map((concept) => ({
          ...concept,
          movementHistory: concept.movementHistory.filter(
            (movement) =>
              new Date(movement.createdAt).getTime() >= windowStartMs,
          ),
        }));
      }

      const suppress = collectCanonicalMovementModelUpdateIds(productConcepts);
      const canonicalItems = flattenCanonicalMovementsForLists(productConcepts)
        .map(toCanonicalServiceItem)
        .filter((item): item is CanonicalMovementServiceItem => Boolean(item));

      const legacyRows = await tx.modelUpdate.findMany({
        where: {
          userId: args.userId,
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
          ...(args.createdAtGte ? { createdAt: { gte: args.createdAtGte } } : {}),
          ...(suppress.size > 0 ? { id: { notIn: [...suppress] } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: args.limit,
        select: {
          id: true,
          updateType: true,
          affectedObjectType: true,
          affectedObjectId: true,
          userFacingSummary: true,
          createdAt: true,
        },
      });

      const legacyItems = legacyRows
        .map((row) => toLegacyServiceItem(row))
        .filter((item): item is LegacyMovementServiceItem => Boolean(item));

      // Defense: a canonical ModelUpdate must never enter via the legacy branch.
      for (const item of legacyItems) {
        if (suppress.has(item.id)) {
          throw new Error(
            "Invariant violated: canonical ModelUpdate entered legacy movement branch",
          );
        }
      }

      const items = mergeCanonicalAndLegacyMovementServiceItems({
        canonicalItems,
        legacyItems,
        limit: args.limit,
      });

      return { items, canonicalConcepts: productConcepts };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60_000,
      maxWait: 60_000,
    },
  );
}

export type { CanonicalMovementListRow };
export { Prisma };
