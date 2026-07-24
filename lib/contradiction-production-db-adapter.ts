/**
 * Narrow typed Prisma adapter for production contradiction ingestion.
 *
 * Provides:
 * - same-session ReferenceItem retrieval
 * - authoritative Message resolution for dual-side lineage
 * - repaired transactional persistence boundary
 *
 * Does not alter Prisma schema. Avoids broad `any` casts by declaring the
 * exact subset of Prisma client operations required.
 */

import type { ResolvedMessageForLineage } from "./contradiction-dual-side-lineage";
import type { ContradictionNaturalEntryMessageResolver } from "./contradiction-natural-entry";
import type { ContradictionRepairedPersistenceDb } from "./contradiction-repaired-persistence";
import {
  buildSameSessionReferenceQuery,
  type SameSessionReferenceRow,
} from "./contradiction-same-session-selection";
import type { ReferenceStatus } from "@prisma/client";

export type ContradictionProductionReferenceLoader = {
  loadSameSessionReferences(args: {
    userId: string;
    sessionId: string;
    referenceStatuses?: ReferenceStatus[];
  }): Promise<SameSessionReferenceRow[]>;
};

export type ContradictionProductionDb = ContradictionProductionReferenceLoader & {
  messageResolver: ContradictionNaturalEntryMessageResolver;
  persistenceDb: ContradictionRepairedPersistenceDb;
};

type PrismaContradictionProductionClient = {
  referenceItem: {
    findMany: (args: {
      where: {
        userId: string;
        status: { in: ReferenceStatus[] };
        type: { in: Array<"goal" | "constraint"> };
        sourceSessionId: string;
      };
      orderBy: Array<{ confidence: "desc" } | { updatedAt: "desc" }>;
      take: number;
      select: {
        id: true;
        type: true;
        statement: true;
        status: true;
        confidence: true;
        sourceSessionId: true;
        sourceMessageId: true;
        sourceMessage: {
          select: {
            id: true;
            sessionId: true;
            userId: true;
            content: true;
          };
        };
      };
    }) => Promise<SameSessionReferenceRow[]>;
  };
  message: {
    findMany: (args: {
      where: {
        userId: string;
        sessionId: string;
        id: { in: string[] };
      };
      select: {
        id: true;
        userId: true;
        sessionId: true;
        content: true;
      };
    }) => Promise<
      Array<{
        id: string;
        userId: string;
        sessionId: string;
        content: string;
      }>
    >;
    findUnique: ContradictionRepairedPersistenceDb["message"]["findUnique"];
  };
  evidenceSpan: ContradictionRepairedPersistenceDb["evidenceSpan"];
  contradictionNode: ContradictionRepairedPersistenceDb["contradictionNode"];
  $transaction: ContradictionRepairedPersistenceDb["$transaction"];
};

function createMessageResolver(
  db: PrismaContradictionProductionClient,
): ContradictionNaturalEntryMessageResolver {
  return {
    async resolveMessages(args) {
      const ids = Array.from(
        new Set([args.sideAMessageId, args.sideBMessageId]),
      );
      const rows = await db.message.findMany({
        where: {
          userId: args.userId,
          sessionId: args.sessionId,
          id: { in: ids },
        },
        select: {
          id: true,
          userId: true,
          sessionId: true,
          content: true,
        },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const toResolved = (
        id: string,
      ): ResolvedMessageForLineage | null => {
        const row = byId.get(id);
        if (!row) return null;
        return {
          id: row.id,
          userId: row.userId,
          sessionId: row.sessionId,
          content: row.content,
        };
      };
      return {
        sideA: toResolved(args.sideAMessageId),
        sideB: toResolved(args.sideBMessageId),
      };
    },
  };
}

function createPersistenceDb(
  db: PrismaContradictionProductionClient,
): ContradictionRepairedPersistenceDb {
  return {
    message: {
      findUnique: (args) => db.message.findUnique(args),
    },
    evidenceSpan: db.evidenceSpan,
    contradictionNode: db.contradictionNode,
    $transaction: (fn) => db.$transaction(fn),
  };
}

/**
 * Narrow adapter over a Prisma-like client (typically `prismadb`).
 */
export function createPrismaContradictionProductionAdapter(
  db: PrismaContradictionProductionClient,
): ContradictionProductionDb {
  return {
    async loadSameSessionReferences(args) {
      const query = buildSameSessionReferenceQuery({
        userId: args.userId,
        sessionId: args.sessionId,
        referenceStatuses: args.referenceStatuses,
      });
      // Copy readonly tuple → mutable array for Prisma EnumReferenceTypeFilter.
      return db.referenceItem.findMany({
        ...query,
        where: {
          ...query.where,
          type: { in: [...query.where.type.in] },
        },
      });
    },
    messageResolver: createMessageResolver(db),
    persistenceDb: createPersistenceDb(db),
  };
}
