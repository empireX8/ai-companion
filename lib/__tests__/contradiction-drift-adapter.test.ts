/**
 * Contradiction Drift Adapter tests (P3-04)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { deriveContradictionDriftClues } from "../contradiction-drift-adapter";

// ── Mock DB factory ───────────────────────────────────────────────────────────

type ContradictionRow = {
  id: string;
  type: string;
  title: string;
  escalationLevel: number;
  weight: number;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  evidence: Array<{ quote: string | null; sessionId: string | null; messageId: string | null }>;
};

function makeMockDb(rows: ContradictionRow[]) {
  const db = {
    contradictionNode: {
      findMany: async () => rows,
    },
  };
  return db as unknown as PrismaClient;
}

function makeNode(overrides: Partial<ContradictionRow> = {}): ContradictionRow {
  return {
    id: "node1",
    type: "goal_behavior_gap",
    title: "Gap",
    escalationLevel: 2,
    weight: 0.8,
    sourceSessionId: "sess1",
    sourceMessageId: "msg1",
    evidence: [{ quote: "I keep failing", sessionId: "sess1", messageId: "msg1" }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deriveContradictionDriftClues — threshold guards", () => {
  it("returns empty when fewer than 3 total qualifying contradictions", async () => {
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "goal_behavior_gap" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues).toHaveLength(0);
  });

  it("returns empty when qualifying contradictions are spread 1-per-type (no type has 2+)", async () => {
    // 3 total nodes but each is a different type — no drift by type
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "value_conflict" }),
      makeNode({ id: "n3", type: "belief_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues).toHaveLength(0);
  });
});

describe("deriveContradictionDriftClues — clue production", () => {
  it("produces a clue when 2+ nodes of same type exist (and total >= 3)", async () => {
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "goal_behavior_gap" }),
      makeNode({ id: "n3", type: "value_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.patternType).toBe("contradiction_drift");
  });

  it("summary includes the contradiction type and count", async () => {
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "goal_behavior_gap" }),
      makeNode({ id: "n3", type: "goal_behavior_gap" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues[0]!.summary).toContain("goal behavior gap");
    expect(clues[0]!.summary).toContain("3");
  });

  it("produces multiple clues when multiple types each have 2+ nodes", async () => {
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "goal_behavior_gap" }),
      makeNode({ id: "n3", type: "value_conflict" }),
      makeNode({ id: "n4", type: "value_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues).toHaveLength(2);
    const types = clues.map((c) => c.patternType);
    expect(types.every((t) => t === "contradiction_drift")).toBe(true);
  });

  it("userId is forwarded to each clue", async () => {
    const db = makeMockDb([
      makeNode({ id: "n1", type: "goal_behavior_gap" }),
      makeNode({ id: "n2", type: "goal_behavior_gap" }),
      makeNode({ id: "n3", type: "value_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "user42", db });
    expect(clues[0]!.userId).toBe("user42");
  });

  it("carries evidence context (sessionId, messageId, quote) from the representative node", async () => {
    const db = makeMockDb([
      makeNode({
        id: "n1",
        type: "goal_behavior_gap",
        evidence: [{ quote: "specific quote", sessionId: "sess99", messageId: "msg99" }],
      }),
      makeNode({ id: "n2", type: "goal_behavior_gap", evidence: [] }),
      makeNode({ id: "n3", type: "value_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    const driftClue = clues[0]!;
    expect(driftClue.quote).toBe("specific quote");
    expect(driftClue.sessionId).toBe("sess99");
    expect(driftClue.messageId).toBe("msg99");
  });

  it("falls back to sourceSessionId/sourceMessageId when evidence is empty", async () => {
    const db = makeMockDb([
      makeNode({
        id: "n1",
        type: "goal_behavior_gap",
        sourceSessionId: "fallback_sess",
        sourceMessageId: "fallback_msg",
        evidence: [],
      }),
      makeNode({ id: "n2", type: "goal_behavior_gap", evidence: [] }),
      makeNode({ id: "n3", type: "value_conflict" }),
    ]);
    const clues = await deriveContradictionDriftClues({ userId: "u1", db });
    expect(clues[0]!.sessionId).toBe("fallback_sess");
    expect(clues[0]!.messageId).toBe("fallback_msg");
  });
});
