import { describe, expect, it, vi } from "vitest";

import { backfillImportedContradictionsForUser } from "../contradiction-backfill";

function makeBackfillDb() {
  const sessions = [
    { id: "imported-session", userId: "u1", origin: "IMPORTED_ARCHIVE" },
    { id: "app-session", userId: "u1", origin: "APP" },
  ];

  const messages = [
    {
      id: "imported-msg-1",
      userId: "u1",
      sessionId: "imported-session",
      role: "user",
      content: "I failed and skipped my workout again this week.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "app-msg-1",
      userId: "u1",
      sessionId: "app-session",
      role: "user",
      content: "I failed and skipped my workout again this week.",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ];

  const references = [
    {
      id: "ref-goal-1",
      userId: "u1",
      type: "goal",
      statement: "Work out five times per week",
      status: "candidate",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      confidence: "medium",
    },
  ];

  const nodes: Array<Record<string, unknown>> = [];
  const evidence: Array<Record<string, unknown>> = [];
  let nodeSeq = 0;
  let evidenceSeq = 0;

  const tx = {
    contradictionNode: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const statuses =
          typeof where.status === "object" &&
          where.status !== null &&
          "in" in where.status &&
          Array.isArray(where.status.in)
            ? (where.status.in as string[])
            : null;

        return nodes.filter((node) => {
          if (where.userId && node.userId !== where.userId) return false;
          if (statuses && !statuses.includes(node.status as string)) return false;
          return true;
        }) as Array<{
          id: string;
          type: "goal_behavior_gap";
          sideA: string;
          sideB: string;
        }>;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const statuses =
          typeof where.status === "object" &&
          where.status !== null &&
          "in" in where.status &&
          Array.isArray(where.status.in)
            ? (where.status.in as string[])
            : null;

        return (
          nodes.find((node) => {
            if (where.id && node.id !== where.id) return false;
            if (where.userId && node.userId !== where.userId) return false;
            if (where.title && node.title !== where.title) return false;
            if (where.sideA && node.sideA !== where.sideA) return false;
            if (where.sideB && node.sideB !== where.sideB) return false;
            if (where.type && node.type !== where.type) return false;
            if (statuses && !statuses.includes(node.status as string)) return false;
            return true;
          }) ?? null
        ) as { id: string; status: string } | null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `node-${++nodeSeq}`, ...data };
        nodes.push(row);
        return { id: row.id as string };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = nodes.findIndex((node) => node.id === where.id);
        if (index === -1) throw new Error(`missing node ${where.id}`);

        const current = nodes[index]!;
        const nextEvidenceCount =
          typeof data.evidenceCount === "object" &&
          data.evidenceCount !== null &&
          "increment" in data.evidenceCount
            ? Number(current.evidenceCount ?? 0) +
              Number((data.evidenceCount as { increment: number }).increment)
            : current.evidenceCount;

        nodes[index] = {
          ...current,
          ...data,
          evidenceCount: nextEvidenceCount,
        };

        return nodes[index]!;
      }),
    },
    contradictionEvidence: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          evidence.find((row) => {
            if (where.nodeId && row.nodeId !== where.nodeId) return false;
            if (
              Object.prototype.hasOwnProperty.call(where, "messageId") &&
              row.messageId !== where.messageId
            ) {
              return false;
            }
            return true;
          }) ?? null
        ) as { id: string } | null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `evidence-${++evidenceSeq}`, ...data };
        evidence.push(row);
        return row;
      }),
    },
  };

  const db = {
    message: {
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { userId: string; role: "user"; session: { origin: "IMPORTED_ARCHIVE" } };
          take?: number;
        }) => {
          const filtered = messages
            .filter((message) => message.userId === where.userId && message.role === where.role)
            .filter((message) => {
              const session = sessions.find((row) => row.id === message.sessionId);
              return session?.origin === where.session.origin;
            })
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

          return typeof take === "number" ? filtered.slice(0, take) : filtered;
        }
      ),
    },
    referenceItem: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const statuses =
          typeof where.status === "object" &&
          where.status !== null &&
          "in" in where.status &&
          Array.isArray(where.status.in)
            ? (where.status.in as string[])
            : [];

        return references
          .filter((reference) => reference.userId === where.userId)
          .filter((reference) => statuses.includes(reference.status))
          .filter((reference) => ["goal", "constraint"].includes(reference.type))
          .map((reference) => ({
            id: reference.id,
            type: reference.type,
            statement: reference.statement,
          }));
      }),
    },
    ...tx,
    $transaction: vi.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) =>
      callback(tx)
    ),
  };

  return { db, nodes, evidence };
}

describe("backfillImportedContradictionsForUser", () => {
  it("processes imported user messages and is safe to rerun", async () => {
    const { db, nodes, evidence } = makeBackfillDb();

    const first = await backfillImportedContradictionsForUser({
      userId: "u1",
      db: db as never,
    });

    expect(first).toEqual({
      messagesScanned: 1,
      messagesWithDetections: 1,
      nodesCreated: 1,
      evidenceCreated: 1,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 0,
    });
    expect(nodes).toHaveLength(1);
    expect(evidence).toHaveLength(1);

    const second = await backfillImportedContradictionsForUser({
      userId: "u1",
      db: db as never,
    });

    expect(second).toEqual({
      messagesScanned: 1,
      messagesWithDetections: 1,
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 1,
      terminalCollisionSkips: 0,
    });
    expect(nodes).toHaveLength(1);
    expect(evidence).toHaveLength(1);
  });
});
