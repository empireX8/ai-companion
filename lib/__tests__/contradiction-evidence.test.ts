import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  addEvidenceToContradiction,
  EvidenceNodeNotFoundError,
} from "../contradiction-evidence";

// ── Mock DB factory ──────────────────────────────────────────────────────────

type EvidenceCreateArgs = {
  data: {
    nodeId: string;
    source: string;
    quote: string | null;
    sessionId: string | null;
  };
  select: Record<string, unknown>;
};

type NodeUpdateArgs = {
  where: { id: string };
  data: Record<string, unknown>;
  select: Record<string, unknown>;
};

type MockEvidence = {
  id: string;
  createdAt: Date;
  source: string;
  quote: string | null;
  sessionId: string | null;
};

type MockNode = {
  id: string;
  snoozeCount: number;
  avoidanceCount: number;
  timesSurfaced: number;
  lastEscalatedAt: Date | null;
  lastTouchedAt: Date;
  lastEvidenceAt: Date | null;
  escalationLevel: number;
  evidenceCount: number;
  recommendedRung: string | null;
};

function makeMockDb(opts: {
  nodeExists?: boolean;
  nodeData?: Partial<MockNode>;
}) {
  const evidenceCreateCalls: EvidenceCreateArgs[] = [];
  const nodeUpdateCalls: NodeUpdateArgs[] = [];

  const baseNode: MockNode = {
    id: "node_1",
    snoozeCount: 0,
    avoidanceCount: 0,
    timesSurfaced: 0,
    lastEscalatedAt: null,
    lastTouchedAt: new Date("2026-01-01T00:00:00Z"),
    lastEvidenceAt: null,
    escalationLevel: 0,
    evidenceCount: 0,
    recommendedRung: "rung1_gentle_mirror",
    ...opts.nodeData,
  };

  const db = {
    contradictionNode: {
      findFirst: async () => {
        if (!opts.nodeExists) return null;
        return baseNode;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      let callIndex = 0;

      const tx = {
        contradictionEvidence: {
          create: async ({ data, select }: EvidenceCreateArgs) => {
            evidenceCreateCalls.push({ data, select });
            const evidence: MockEvidence = {
              id: "ev_1",
              createdAt: new Date("2026-02-25T12:00:00Z"),
              source: data.source,
              quote: data.quote,
              sessionId: data.sessionId,
            };
            return evidence;
          },
        },
        contradictionNode: {
          update: async ({ where, data, select }: NodeUpdateArgs) => {
            nodeUpdateCalls.push({ where, data, select });
            callIndex++;

            if (callIndex === 1) {
              // First update: returns updated node stats
              return {
                ...baseNode,
                evidenceCount: baseNode.evidenceCount + 1,
                lastEvidenceAt: new Date("2026-02-25T12:00:00Z"),
                lastTouchedAt: new Date("2026-02-25T12:00:00Z"),
              };
            }
            // Second update: escalation
            return {
              evidenceCount: baseNode.evidenceCount + 1,
              lastEvidenceAt: new Date("2026-02-25T12:00:00Z"),
              lastTouchedAt: new Date("2026-02-25T12:00:00Z"),
              escalationLevel: 0,
              recommendedRung: "rung1_gentle_mirror",
            };
          },
        },
      };

      return fn(tx);
    },
  };

  return {
    db: db as unknown as PrismaClient,
    evidenceCreateCalls,
    nodeUpdateCalls,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("addEvidenceToContradiction", () => {
  const now = new Date("2026-02-25T12:00:00Z");

  it("throws EvidenceNodeNotFoundError when contradiction does not exist", async () => {
    const { db } = makeMockDb({ nodeExists: false });

    await expect(
      addEvidenceToContradiction({
        userId: "u1",
        contradictionId: "node_missing",
        source: "user_input",
        note: "test note",
        now,
        db,
      })
    ).rejects.toThrow(EvidenceNodeNotFoundError);
  });

  it("throws EvidenceNodeNotFoundError when contradiction belongs to another user", async () => {
    const { db } = makeMockDb({ nodeExists: false });

    await expect(
      addEvidenceToContradiction({
        userId: "other_user",
        contradictionId: "node_1",
        source: "user_input",
        note: "test note",
        now,
        db,
      })
    ).rejects.toThrow(EvidenceNodeNotFoundError);
  });

  it("creates evidence with the correct source, quote, and nodeId", async () => {
    const { db, evidenceCreateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "reflection",
      note: "  my observation  ",
      now,
      db,
    });

    expect(evidenceCreateCalls).toHaveLength(1);
    expect(evidenceCreateCalls[0]!.data).toMatchObject({
      nodeId: "node_1",
      source: "reflection",
      quote: "  my observation  ",
      sessionId: null,
    });
  });

  it("stores sessionId when provided", async () => {
    const { db, evidenceCreateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "session",
      note: "observed in session",
      sessionId: "sess_abc",
      now,
      db,
    });

    expect(evidenceCreateCalls[0]!.data.sessionId).toBe("sess_abc");
  });

  it("stores null sessionId when not provided", async () => {
    const { db, evidenceCreateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "user_input",
      note: "some note",
      now,
      db,
    });

    expect(evidenceCreateCalls[0]!.data.sessionId).toBeNull();
  });

  it("increments evidenceCount in the first node update", async () => {
    const { db, nodeUpdateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "user_input",
      note: "note",
      now,
      db,
    });

    const firstUpdate = nodeUpdateCalls[0]!;
    expect(firstUpdate.data).toMatchObject({
      evidenceCount: { increment: 1 },
    });
  });

  it("sets lastEvidenceAt and lastTouchedAt to now in the first node update", async () => {
    const { db, nodeUpdateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "user_input",
      note: "note",
      now,
      db,
    });

    const firstUpdate = nodeUpdateCalls[0]!;
    expect(firstUpdate.data).toMatchObject({
      lastEvidenceAt: now,
      lastTouchedAt: now,
    });
  });

  it("performs a second node update for escalation recalculation", async () => {
    const { db, nodeUpdateCalls } = makeMockDb({ nodeExists: true });

    await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "user_input",
      note: "note",
      now,
      db,
    });

    expect(nodeUpdateCalls.length).toBeGreaterThanOrEqual(2);
    const secondUpdate = nodeUpdateCalls[1]!;
    expect(secondUpdate.data).toHaveProperty("escalationLevel");
    expect(secondUpdate.data).toHaveProperty("recommendedRung");
  });

  it("returns evidence and node fields in the result", async () => {
    const { db } = makeMockDb({ nodeExists: true });

    const result = await addEvidenceToContradiction({
      userId: "u1",
      contradictionId: "node_1",
      source: "user_input",
      note: "some note",
      now,
      db,
    });

    expect(result).toHaveProperty("evidence");
    expect(result).toHaveProperty("node");
    expect(result.evidence).toMatchObject({
      id: expect.any(String),
      source: "user_input",
    });
    expect(result.node).toMatchObject({
      evidenceCount: expect.any(Number),
      escalationLevel: expect.any(Number),
      recommendedRung: expect.any(String),
    });
  });

  it("EvidenceNodeNotFoundError has status 404", () => {
    const err = new EvidenceNodeNotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe("CONTRADICTION_NOT_FOUND");
  });
});
