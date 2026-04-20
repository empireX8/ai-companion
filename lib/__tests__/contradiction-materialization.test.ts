import { describe, expect, it, vi } from "vitest";

import { materializeContradictions } from "../contradiction-materialization";

function makeMockDb() {
  const nodes: Array<Record<string, unknown>> = [];
  const evidence: Array<Record<string, unknown>> = [];

  let nodeSeq = 0;
  let evidenceSeq = 0;

  const tx = {
    contradictionNode: {
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
            if (
              Object.prototype.hasOwnProperty.call(where, "sessionId") &&
              row.sessionId !== where.sessionId
            ) {
              return false;
            }
            if (
              Object.prototype.hasOwnProperty.call(where, "quote") &&
              row.quote !== where.quote
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
    ...tx,
    $transaction: vi.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) =>
      callback(tx)
    ),
  };

  return { db, nodes, evidence };
}

describe("materializeContradictions", () => {
  it("creates a new contradiction node and evidence when no match exists", async () => {
    const { db, nodes, evidence } = makeMockDb();

    const result = await materializeContradictions({
      userId: "u1",
      sessionId: "s1",
      messageId: "m1",
      quote: "I skipped the workout again.",
      detections: [
        {
          title: "Goal behavior gap",
          sideA: "Work out five times per week",
          sideB: "I skipped the workout again.",
          type: "goal_behavior_gap",
          confidence: "medium",
        },
      ],
      db: db as never,
    });

    expect(result).toEqual({
      nodesCreated: 1,
      evidenceCreated: 1,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 0,
    });
    expect(nodes).toHaveLength(1);
    expect(evidence).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      status: "candidate",
      sourceMessageId: "m1",
      evidenceCount: 1,
    });
  });

  it("reuses an existing appendable node and skips duplicate evidence on rerun", async () => {
    const { db, nodes, evidence } = makeMockDb();

    nodes.push({
      id: "node-existing",
      userId: "u1",
      title: "Goal behavior gap",
      sideA: "Work out five times per week",
      sideB: "I skipped the workout again.",
      type: "goal_behavior_gap",
      status: "candidate",
      evidenceCount: 1,
    });
    evidence.push({
      id: "evidence-existing",
      nodeId: "node-existing",
      messageId: "m1",
      sessionId: "s1",
      quote: "I skipped the workout again.",
    });

    const result = await materializeContradictions({
      userId: "u1",
      sessionId: "s1",
      messageId: "m1",
      quote: "I skipped the workout again.",
      detections: [
        {
          title: "Goal behavior gap",
          sideA: "Work out five times per week",
          sideB: "I skipped the workout again.",
          type: "goal_behavior_gap",
          confidence: "medium",
        },
      ],
      db: db as never,
    });

    expect(result).toEqual({
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 1,
      terminalCollisionSkips: 0,
    });
    expect(nodes).toHaveLength(1);
    expect(evidence).toHaveLength(1);
  });

  it("avoids creating a duplicate node when an exact terminal collision already exists", async () => {
    const { db, nodes, evidence } = makeMockDb();

    nodes.push({
      id: "node-terminal",
      userId: "u1",
      title: "Goal behavior gap",
      sideA: "Work out five times per week",
      sideB: "I skipped the workout again.",
      type: "goal_behavior_gap",
      status: "resolved",
      evidenceCount: 1,
    });

    const result = await materializeContradictions({
      userId: "u1",
      sessionId: "s1",
      messageId: "m2",
      quote: "I skipped the workout again.",
      detections: [
        {
          title: "Goal behavior gap",
          sideA: "Work out five times per week",
          sideB: "I skipped the workout again.",
          type: "goal_behavior_gap",
          confidence: "medium",
        },
      ],
      db: db as never,
    });

    expect(result).toEqual({
      nodesCreated: 0,
      evidenceCreated: 0,
      reusedExistingNodes: 0,
      duplicateEvidenceSkips: 0,
      terminalCollisionSkips: 1,
    });
    expect(nodes).toHaveLength(1);
    expect(evidence).toHaveLength(0);
  });
});
