import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectContradictions, detectContradictionsFromData } from "../contradiction-detection";

const prismaMock = vi.hoisted(() => ({
  referenceItem: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
}));

vi.mock("../prismadb", () => ({ default: prismaMock }));

describe("detectContradictionsFromData", () => {
  it("detects goal mismatch contradictions", () => {
    const detections = detectContradictionsFromData({
      messageContent: "I failed and I skipped my workout again this week.",
      activeReferences: [
        {
          id: "ref-1",
          type: "goal",
          statement: "Work out five times per week",
        },
      ],
      existingNodes: [],
    });

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      type: "goal_behavior_gap",
      confidence: "medium",
      sideA: "Work out five times per week",
    });
    expect(detections[0].existingNodeId).toBeUndefined();
  });

  it("returns empty when there is no reference conflict signal", () => {
    const detections = detectContradictionsFromData({
      messageContent: "I completed my workout and meal prep on schedule.",
      activeReferences: [
        {
          id: "ref-1",
          type: "goal",
          statement: "Work out five times per week",
        },
      ],
      existingNodes: [],
    });

    expect(detections).toEqual([]);
  });

  it("returns empty when activeReferences list is empty (no goals/constraints)", () => {
    const detections = detectContradictionsFromData({
      messageContent: "I failed and I skipped my workout again this week.",
      activeReferences: [],
      existingNodes: [],
    });

    expect(detections).toEqual([]);
  });

  it("matches existing node and returns append-not-create detection", () => {
    const detections = detectContradictionsFromData({
      messageContent: "I failed and I skipped my workout again this week.",
      activeReferences: [
        {
          id: "ref-1",
          type: "goal",
          statement: "Work out five times per week",
        },
      ],
      existingNodes: [
        {
          id: "node-1",
          type: "goal_behavior_gap",
          sideA: "Work out five times per week",
          sideB: "I skipped my workouts again this week.",
        },
      ],
    });

    expect(detections).toHaveLength(1);
    expect(detections[0].existingNodeId).toBe("node-1");
  });
});

// ── detectContradictions (async DB path) ─────────────────────────────────────
//
// These tests verify the referenceStatuses gate: the import pipeline must pass
// ["active", "candidate"] so that references extracted during import are
// visible to contradiction detection in the same run.

describe("detectContradictions — referenceStatuses gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("defaults to querying only active references", async () => {
    prismaMock.referenceItem.findMany.mockResolvedValue([]);

    await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week",
    });

    expect(prismaMock.referenceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["active"] },
        }),
      })
    );
  });

  it("queries active + candidate when referenceStatuses includes both", async () => {
    prismaMock.referenceItem.findMany.mockResolvedValue([]);

    await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week",
      referenceStatuses: ["active", "candidate"],
    });

    expect(prismaMock.referenceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["active", "candidate"] },
        }),
      })
    );
  });

  it("detects a goal_behavior_gap when a candidate reference is included", async () => {
    // Simulates the import path: the goal was just extracted as "candidate"
    // and is visible because referenceStatuses includes "candidate".
    prismaMock.referenceItem.findMany.mockResolvedValue([
      { id: "ref-1", type: "goal", statement: "I want to exercise five times a week" },
    ]);

    const detections = await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week — skipped every session.",
      referenceStatuses: ["active", "candidate"],
    });

    expect(detections).toHaveLength(1);
    expect(detections[0]!.type).toBe("goal_behavior_gap");
    expect(detections[0]!.sideA).toBe("I want to exercise five times a week");
  });

  it("returns empty when only candidate references exist but default statuses used", async () => {
    // Simulates live-chat path: candidate references are not visible by default.
    prismaMock.referenceItem.findMany.mockResolvedValue([]);

    const detections = await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week — skipped every session.",
      // No referenceStatuses → defaults to ["active"] → mock returns []
    });

    expect(detections).toEqual([]);
  });
});
