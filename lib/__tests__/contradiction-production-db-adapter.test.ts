/**
 * Focused Prisma-shaped adapter tests for
 * createPrismaContradictionProductionAdapter.
 *
 * Fake Prisma client only. No real database. No live providers.
 */

import { describe, expect, it, vi } from "vitest";

import { createPrismaContradictionProductionAdapter } from "../contradiction-production-db-adapter";
import { buildSameSessionReferenceQuery } from "../contradiction-same-session-selection";
import type { ContradictionRepairedPersistenceDb } from "../contradiction-repaired-persistence";

const USER = "adapter-test-user";
const SESSION = "adapter-test-session";
const MSG_A = "adapter-msg-a";
const MSG_B = "adapter-msg-b";

type ReferenceFindManyArgs = {
  where: {
    userId: string;
    status: { in: string[] };
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
};
type MessageFindManyArgs = {
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
};

describe("createPrismaContradictionProductionAdapter", () => {
  it("A. Reference loading: same-session scoped query with nested sourceMessage", async () => {
    const findMany = vi.fn(async (_args: ReferenceFindManyArgs) => {
      void _args;
      return [
        {
          id: "ref-1",
          type: "goal",
          statement: "never drink",
          status: "active",
          confidence: "high",
          sourceSessionId: SESSION,
          sourceMessageId: MSG_A,
          sourceMessage: {
            id: MSG_A,
            sessionId: SESSION,
            userId: USER,
            content: "I never drink alcohol",
          },
        },
      ];
    });

    const adapter = createPrismaContradictionProductionAdapter({
      referenceItem: { findMany },
      message: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      evidenceSpan: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      contradictionNode: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    });

    const rows = await adapter.loadSameSessionReferences({
      userId: USER,
      sessionId: SESSION,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0]?.[0] as ReferenceFindManyArgs;
    const expected = buildSameSessionReferenceQuery({
      userId: USER,
      sessionId: SESSION,
    });

    expect(query.where.userId).toBe(USER);
    expect(query.where.sourceSessionId).toBe(SESSION);
    expect(query.where.status).toEqual({ in: ["active"] });
    expect([...query.where.type.in]).toEqual(["goal", "constraint"]);
    expect(query.take).toBe(50);
    expect(query.take).toBe(expected.take);
    expect(query.select.sourceMessage).toEqual({
      select: {
        id: true,
        sessionId: true,
        userId: true,
        content: true,
      },
    });
    expect(query.select.sourceSessionId).toBe(true);
    expect(query.select.sourceMessageId).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceMessage?.content).toBe("I never drink alcohol");
  });

  it("B. Message resolution: scoped IDs; missing/foreign → null", async () => {
    const findMany = vi.fn(async (args: MessageFindManyArgs) => {
      expect(args.where.userId).toBe(USER);
      expect(args.where.sessionId).toBe(SESSION);
      // Only Side B exists for this user/session; Side A missing.
      if (args.where.id.in.includes(MSG_B)) {
        return [
          {
            id: MSG_B,
            userId: USER,
            sessionId: SESSION,
            content: "I drank last night",
          },
        ];
      }
      return [];
    });

    const adapter = createPrismaContradictionProductionAdapter({
      referenceItem: { findMany: vi.fn() },
      message: {
        findMany,
        findUnique: vi.fn(),
      },
      evidenceSpan: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      contradictionNode: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    });

    const resolved = await adapter.messageResolver.resolveMessages({
      userId: USER,
      sessionId: SESSION,
      sideAMessageId: MSG_A,
      sideBMessageId: MSG_B,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const callArgs = findMany.mock.calls[0]?.[0] as MessageFindManyArgs;
    expect(callArgs.where.userId).toBe(USER);
    expect(callArgs.where.sessionId).toBe(SESSION);
    expect([...callArgs.where.id.in].sort()).toEqual([MSG_A, MSG_B].sort());
    expect(callArgs.select).toEqual({
      id: true,
      userId: true,
      sessionId: true,
      content: true,
    });
    expect(resolved.sideA).toBeNull();
    expect(resolved.sideB).toEqual({
      id: MSG_B,
      userId: USER,
      sessionId: SESSION,
      content: "I drank last night",
    });
  });

  it("B2. Message resolution rejects foreign-session rows via scoped query", async () => {
    const findMany = vi.fn(async (_args: MessageFindManyArgs) => {
      void _args;
      return [];
    });
    const adapter = createPrismaContradictionProductionAdapter({
      referenceItem: { findMany: vi.fn() },
      message: {
        findMany,
        findUnique: vi.fn(),
      },
      evidenceSpan: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      contradictionNode: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    });

    const resolved = await adapter.messageResolver.resolveMessages({
      userId: USER,
      sessionId: SESSION,
      sideAMessageId: MSG_A,
      sideBMessageId: MSG_B,
    });

    const callArgs = findMany.mock.calls[0]?.[0] as MessageFindManyArgs;
    expect(callArgs.where.sessionId).toBe(SESSION);
    expect(callArgs.where.userId).toBe(USER);
    expect(resolved.sideA).toBeNull();
    expect(resolved.sideB).toBeNull();
  });

  it("C. Transaction forwarding uses transaction-scoped delegates", async () => {
    const rootMessageFindUnique = vi.fn(async () => {
      throw new Error("root message.findUnique must not be used inside tx");
    });
    const txMessageFindUnique = vi.fn(async () => ({
      id: MSG_B,
      userId: USER,
      sessionId: SESSION,
      content: "tx content",
    }));
    const txEvidenceFindUnique = vi.fn(async () => null);
    const txNodeFindFirst = vi.fn(async () => null);

    const txClient = {
      message: { findUnique: txMessageFindUnique },
      evidenceSpan: {
        findUnique: txEvidenceFindUnique,
        create: vi.fn(),
      },
      contradictionNode: {
        findFirst: txNodeFindFirst,
        create: vi.fn(),
      },
    };

    const $transaction = vi.fn(
      async <T>(
        fn: (tx: typeof txClient) => Promise<T>,
      ): Promise<T> => fn(txClient),
    );

    const adapter = createPrismaContradictionProductionAdapter({
      referenceItem: { findMany: vi.fn() },
      message: {
        findMany: vi.fn(),
        findUnique: rootMessageFindUnique,
      },
      evidenceSpan: {
        findUnique: vi.fn(async () => {
          throw new Error("root evidenceSpan must not be used inside tx");
        }),
        create: vi.fn(),
      },
      contradictionNode: {
        findFirst: vi.fn(async () => {
          throw new Error("root contradictionNode must not be used inside tx");
        }),
        create: vi.fn(),
      },
      $transaction: $transaction as ContradictionRepairedPersistenceDb["$transaction"],
    });

    const result = await adapter.persistenceDb.$transaction(async (tx) => {
      const message = await tx.message.findUnique({
        where: { id: MSG_B },
        select: {
          id: true,
          userId: true,
          sessionId: true,
          content: true,
        },
      });
      await tx.evidenceSpan.findUnique({
        where: {
          messageId_charStart_charEnd_contentHash: {
            messageId: MSG_B,
            charStart: 0,
            charEnd: 1,
            contentHash: "abc",
          },
        },
        select: {
          id: true,
          userId: true,
          messageId: true,
          charStart: true,
          charEnd: true,
          contentHash: true,
        },
      });
      await tx.contradictionNode.findFirst({
        where: {
          userId: USER,
          sideASourceSpanId: "span-a",
          sideBSourceSpanId: "span-b",
        },
        select: {
          id: true,
          userId: true,
          sideASourceSpanId: true,
          sideBSourceSpanId: true,
        },
      });
      return message;
    });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(txMessageFindUnique).toHaveBeenCalledTimes(1);
    expect(txEvidenceFindUnique).toHaveBeenCalledTimes(1);
    expect(txNodeFindFirst).toHaveBeenCalledTimes(1);
    expect(rootMessageFindUnique).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: MSG_B,
      userId: USER,
      sessionId: SESSION,
      content: "tx content",
    });
  });
});
