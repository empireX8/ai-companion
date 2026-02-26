import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computeEscalationLevelFromEvidence,
  escalationLevelToRung,
  reconcileImportedStructureForUser,
} from "../import-reconcile";

// ── Mock DB builder ───────────────────────────────────────────────────────────
type FakeNode = {
  id: string;
  userId: string;
  status: string;
  escalationLevel: number;
  recommendedRung: string | null;
  lastTouchedAt: Date;
};

type FakeEvidence = {
  nodeId: string;
  sessionId: string | null;
  createdAt: Date;
  messageId?: string | null;
};

type FakeMessage = {
  id: string;
  createdAt: Date;
  sessionId: string;
};

function makeMockDb(nodes: FakeNode[], evidence: FakeEvidence[], messages: FakeMessage[] = []) {
  const storedNodes = nodes.map((n) => ({ ...n }));
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  const db = {
    contradictionNode: {
      findMany: async ({ where }: { where: { userId?: string; status?: { in: string[] } } }) => {
        return storedNodes.filter((n) => {
          if (where.userId && n.userId !== where.userId) return false;
          if (where.status?.in && !where.status.in.includes(n.status)) return false;
          return true;
        });
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const promise = Promise.resolve().then(() => {
          updates.push({ id: where.id, data });
          const node = storedNodes.find((n) => n.id === where.id);
          if (node) {
            Object.assign(node, data);
          }
          return node;
        });
        return promise;
      },
    },
    contradictionEvidence: {
      findMany: async ({ where }: { where: { nodeId?: { in: string[] } } }) => {
        return evidence.filter((e) => !where.nodeId?.in || where.nodeId.in.includes(e.nodeId));
      },
    },
    message: {
      findMany: async ({ where }: { where: { id?: { in: string[] } } }) => {
        return messages.filter((m) => !where.id?.in || where.id.in.includes(m.id));
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    _updates: updates,
    _nodes: storedNodes,
  };

  return { db: db as unknown as PrismaClient, updates, storedNodes };
}

// ── Unit tests: pure mapping logic ───────────────────────────────────────────
describe("computeEscalationLevelFromEvidence", () => {
  it("returns 0 when evidence count <= 1", () => {
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 1, distinctSessions: 1, daysSpan: 0, temporalSpacingOk: false })).toBe(0);
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 0, distinctSessions: 0, daysSpan: 0, temporalSpacingOk: false })).toBe(0);
  });

  it("returns 1 when evidence >= 2 and temporal spacing ok", () => {
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 2, distinctSessions: 2, daysSpan: 1, temporalSpacingOk: true })).toBe(1);
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 3, distinctSessions: 1, daysSpan: 3, temporalSpacingOk: true })).toBe(1);
  });

  it("returns 2 when evidence >= 4 and distinctSessions >= 2", () => {
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 4, distinctSessions: 2, daysSpan: 1, temporalSpacingOk: true })).toBe(2);
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 6, distinctSessions: 2, daysSpan: 5, temporalSpacingOk: true })).toBe(2);
  });

  it("returns 3 when evidence >= 7, sessions >= 3, days >= 14", () => {
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 7, distinctSessions: 3, daysSpan: 14, temporalSpacingOk: true })).toBe(3);
  });

  it("returns 4 when evidence >= 12, sessions >= 4, days >= 30", () => {
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 12, distinctSessions: 4, daysSpan: 30, temporalSpacingOk: true })).toBe(4);
  });

  it("does not skip levels — highest satisfied threshold wins", () => {
    // 11 evidence, 3 sessions, 14 days → qualifies for level 3 but not 4
    expect(computeEscalationLevelFromEvidence({ totalEvidence: 11, distinctSessions: 3, daysSpan: 14, temporalSpacingOk: true })).toBe(3);
  });
});

describe("escalationLevelToRung", () => {
  it("maps each level to the correct rung", () => {
    expect(escalationLevelToRung(0)).toBe("rung1_gentle_mirror");
    expect(escalationLevelToRung(1)).toBe("rung2_explicit_contradiction");
    expect(escalationLevelToRung(2)).toBe("rung3_evidence_pressure");
    expect(escalationLevelToRung(3)).toBe("rung4_forced_choice_framing");
    expect(escalationLevelToRung(4)).toBe("rung5_structured_probe_offer");
    expect(escalationLevelToRung(5)).toBe("rung5_structured_probe_offer"); // clamps at max
  });
});

// ── Integration-style tests with mock DB ─────────────────────────────────────
describe("reconcileImportedStructureForUser", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const baseDate = new Date("2025-01-01T00:00:00Z");
  const day = (n: number) => new Date(baseDate.getTime() + n * DAY);

  it("returns 0 updated nodes when there are no eligible nodes", async () => {
    const { db } = makeMockDb([], []);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });
    expect(result.updatedNodes).toBe(0);
  });

  it("escalates a node with sufficient multi-session evidence", async () => {
    const node: FakeNode = {
      id: "node_1",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: day(0),
    };
    const evidence: FakeEvidence[] = [
      { nodeId: "node_1", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "node_1", sessionId: "sess_b", createdAt: day(3) },
      { nodeId: "node_1", sessionId: "sess_b", createdAt: day(5) },
      { nodeId: "node_1", sessionId: "sess_c", createdAt: day(7) },
    ];

    const { db, storedNodes } = makeMockDb([node], evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });

    expect(result.updatedNodes).toBe(1);
    expect(storedNodes[0]!.escalationLevel).toBe(2); // 4 evidence, 3 sessions → level 2
    expect(storedNodes[0]!.recommendedRung).toBe("rung3_evidence_pressure");
  });

  it("does not update nodes that already have the correct escalation", async () => {
    const node: FakeNode = {
      id: "node_2",
      userId: "u1",
      status: "open",
      escalationLevel: 1,
      recommendedRung: "rung2_explicit_contradiction",
      lastTouchedAt: day(0),
    };
    const evidence: FakeEvidence[] = [
      { nodeId: "node_2", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "node_2", sessionId: "sess_b", createdAt: day(3) },
    ];

    const { db } = makeMockDb([node], evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });
    expect(result.updatedNodes).toBe(0);
  });

  it("is idempotent — second run returns 0 updates", async () => {
    const node: FakeNode = {
      id: "node_3",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: day(0),
    };
    const evidence: FakeEvidence[] = [
      { nodeId: "node_3", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "node_3", sessionId: "sess_b", createdAt: day(5) },
    ];

    const { db } = makeMockDb([node], evidence);
    const first = await reconcileImportedStructureForUser({ userId: "u1", db });
    expect(first.updatedNodes).toBe(1);

    const second = await reconcileImportedStructureForUser({ userId: "u1", db });
    expect(second.updatedNodes).toBe(0);
  });

  it("does not mutate lastTouchedAt", async () => {
    const fixedTime = day(42);
    const node: FakeNode = {
      id: "node_4",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: fixedTime,
    };
    const evidence: FakeEvidence[] = [
      { nodeId: "node_4", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "node_4", sessionId: "sess_b", createdAt: day(5) },
    ];

    const { db, updates } = makeMockDb([node], evidence);
    await reconcileImportedStructureForUser({ userId: "u1", db });

    // lastTouchedAt must not appear in any update payload
    for (const u of updates) {
      expect(u.data).not.toHaveProperty("lastTouchedAt");
    }
  });

  it("skips snoozed and archived nodes", async () => {
    const nodes: FakeNode[] = [
      { id: "node_5", userId: "u1", status: "snoozed", escalationLevel: 0, recommendedRung: "rung1_gentle_mirror", lastTouchedAt: day(0) },
      { id: "node_6", userId: "u1", status: "archived_tension", escalationLevel: 0, recommendedRung: "rung1_gentle_mirror", lastTouchedAt: day(0) },
      { id: "node_7", userId: "u1", status: "resolved", escalationLevel: 0, recommendedRung: "rung1_gentle_mirror", lastTouchedAt: day(0) },
    ];
    // All would qualify for escalation if eligible
    const evidence: FakeEvidence[] = nodes.flatMap((n) => [
      { nodeId: n.id, sessionId: "sess_a", createdAt: day(0) },
      { nodeId: n.id, sessionId: "sess_b", createdAt: day(3) },
    ]);

    const { db, storedNodes } = makeMockDb(nodes, evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });

    expect(result.updatedNodes).toBe(0);
    for (const n of storedNodes) {
      expect(n.escalationLevel).toBe(0);
    }
  });

  it("does not escalate a node with only 1 evidence row", async () => {
    const node: FakeNode = {
      id: "node_8",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: day(0),
    };
    const evidence: FakeEvidence[] = [
      { nodeId: "node_8", sessionId: "sess_a", createdAt: day(0) },
    ];

    const { db } = makeMockDb([node], evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });
    expect(result.updatedNodes).toBe(0);
  });

  it("handles multiple nodes independently in one pass", async () => {
    const nodes: FakeNode[] = [
      { id: "low", userId: "u1", status: "open", escalationLevel: 0, recommendedRung: "rung1_gentle_mirror", lastTouchedAt: day(0) },
      { id: "mid", userId: "u1", status: "explored", escalationLevel: 0, recommendedRung: "rung1_gentle_mirror", lastTouchedAt: day(0) },
    ];
    const evidence: FakeEvidence[] = [
      // "low" node: 2 evidence, 2 sessions → level 1
      { nodeId: "low", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "low", sessionId: "sess_b", createdAt: day(3) },
      // "mid" node: 7 evidence, 3 sessions, 15 days → level 3
      { nodeId: "mid", sessionId: "sess_a", createdAt: day(0) },
      { nodeId: "mid", sessionId: "sess_a", createdAt: day(2) },
      { nodeId: "mid", sessionId: "sess_b", createdAt: day(5) },
      { nodeId: "mid", sessionId: "sess_b", createdAt: day(7) },
      { nodeId: "mid", sessionId: "sess_c", createdAt: day(10) },
      { nodeId: "mid", sessionId: "sess_c", createdAt: day(13) },
      { nodeId: "mid", sessionId: "sess_c", createdAt: day(15) },
    ];

    const { db, storedNodes } = makeMockDb(nodes, evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });

    expect(result.updatedNodes).toBe(2);
    const low = storedNodes.find((n) => n.id === "low")!;
    const mid = storedNodes.find((n) => n.id === "mid")!;
    expect(low.escalationLevel).toBe(1);
    expect(low.recommendedRung).toBe("rung2_explicit_contradiction");
    expect(mid.escalationLevel).toBe(3);
    expect(mid.recommendedRung).toBe("rung4_forced_choice_framing");
  });

  it("uses message.createdAt for temporal spacing when messageId is present", async () => {
    // Evidence rows have the same createdAt (simulating import-run timestamp),
    // but linked messages have historically spaced timestamps.
    const node: FakeNode = {
      id: "node_ts",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: day(0),
    };
    const importRunTime = day(100); // all evidence inserted at same moment
    const evidence: FakeEvidence[] = [
      { nodeId: "node_ts", sessionId: "sess_a", createdAt: importRunTime, messageId: "msg_a" },
      { nodeId: "node_ts", sessionId: "sess_b", createdAt: importRunTime, messageId: "msg_b" },
    ];
    // Messages have timestamps 3 days apart (historically spaced)
    const messages: FakeMessage[] = [
      { id: "msg_a", createdAt: day(0), sessionId: "sess_a" },
      { id: "msg_b", createdAt: day(3), sessionId: "sess_b" },
    ];

    const { db, storedNodes } = makeMockDb([node], evidence, messages);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });

    // 2 evidence, 2 sessions, daysSpan=3 via message timestamps → level 1
    expect(result.updatedNodes).toBe(1);
    expect(storedNodes[0]!.escalationLevel).toBe(1);
    expect(storedNodes[0]!.recommendedRung).toBe("rung2_explicit_contradiction");
  });

  it("falls back to evidence.createdAt when messageId is absent", async () => {
    const node: FakeNode = {
      id: "node_fb",
      userId: "u1",
      status: "open",
      escalationLevel: 0,
      recommendedRung: "rung1_gentle_mirror",
      lastTouchedAt: day(0),
    };
    // No messageId — reconcile must use evidence.createdAt directly
    const evidence: FakeEvidence[] = [
      { nodeId: "node_fb", sessionId: "sess_a", createdAt: day(0), messageId: null },
      { nodeId: "node_fb", sessionId: "sess_b", createdAt: day(5), messageId: null },
    ];

    const { db, storedNodes } = makeMockDb([node], evidence);
    const result = await reconcileImportedStructureForUser({ userId: "u1", db });

    expect(result.updatedNodes).toBe(1);
    expect(storedNodes[0]!.escalationLevel).toBe(1);
  });
});
