import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  detectContradictions,
  detectContradictionsFromData,
  nominateContradictionMarkersFromData,
  type ContradictionMarkerNomination,
  type DetectedContradiction,
} from "../contradiction-detection";

const prismaMock = vi.hoisted(() => ({
  referenceItem: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
}));

vi.mock("../prismadb", () => ({ default: prismaMock }));

/**
 * CEQR-002 — marker-only creation quarantine.
 *
 * Previous expectations that marker + goal/constraint reference created a
 * DetectedContradiction are invalid: markers are nomination hints only.
 * Zero semantic authorization ⇒ zero persistable detections.
 */
describe("detectContradictionsFromData — CEQR-002 marker-only quarantine", () => {
  it("A: 'but I' alone creates no contradiction", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "but I mean that in a different way today.",
        activeReferences: [
          {
            id: "ref-1",
            type: "constraint",
            statement: "Stay calm under pressure",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("B: 'however I' alone creates no contradiction", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "however I still feel the same pull toward approval.",
        activeReferences: [
          {
            id: "ref-1",
            type: "constraint",
            statement: "Do not seek approval",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("C: 'even though' alone creates no contradiction", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "even though I care about honesty in hard talks.",
        activeReferences: [
          {
            id: "ref-1",
            type: "constraint",
            statement: "Speak honestly",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("D: 'I didn't...' plus active goal reference creates no contradiction", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "I didn't finish the chapter I planned for tonight.",
        activeReferences: [
          {
            id: "ref-1",
            type: "goal",
            statement: "Finish reading this book",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("E: 'I failed...' plus active goal reference creates no contradiction", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "I failed and I skipped my workout again this week.",
        activeReferences: [
          {
            id: "ref-1",
            type: "goal",
            statement: "Work out five times per week",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("F: superficially plausible goal/behaviour pair still abstains without semantic adjudication", () => {
    expect(
      detectContradictionsFromData({
        messageContent:
          "I skipped reading again tonight because I kept scrolling on my phone instead.",
        activeReferences: [
          {
            id: "ref-1",
            type: "goal",
            statement: "I need to finish this book though",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("G: multiple matching goal or constraint references do not fan out into candidates", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "I failed to keep either commitment this week.",
        activeReferences: [
          { id: "ref-1", type: "goal", statement: "Work out five times per week" },
          { id: "ref-2", type: "goal", statement: "Read every evening" },
          { id: "ref-3", type: "constraint", statement: "No late nights" },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("H: high token overlap does not create eligibility", () => {
    expect(
      detectContradictionsFromData({
        messageContent:
          "I failed to finish this book though I need to finish this book though tonight.",
        activeReferences: [
          {
            id: "ref-1",
            type: "goal",
            statement: "I need to finish this book though",
          },
        ],
        existingNodes: [],
      })
    ).toEqual([]);
  });

  it("I: existing-node textual similarity does not bypass quarantine or authorize evidence update", () => {
    expect(
      detectContradictionsFromData({
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
      })
    ).toEqual([]);
  });

  it("J: short / no-marker / no-reference cases continue returning no detections", () => {
    expect(
      detectContradictionsFromData({
        messageContent: "too short",
        activeReferences: [
          { id: "ref-1", type: "goal", statement: "Work out five times per week" },
        ],
        existingNodes: [],
      })
    ).toEqual([]);

    expect(
      detectContradictionsFromData({
        messageContent: "I completed my workout and meal prep on schedule.",
        activeReferences: [
          { id: "ref-1", type: "goal", statement: "Work out five times per week" },
        ],
        existingNodes: [],
      })
    ).toEqual([]);

    expect(
      detectContradictionsFromData({
        messageContent: "I failed and I skipped my workout again this week.",
        activeReferences: [],
        existingNodes: [],
      })
    ).toEqual([]);
  });
});

describe("nominateContradictionMarkersFromData — non-persistable nominations", () => {
  it("K: nominations are explicitly non-persistable and not DetectedContradiction", () => {
    const nominations = nominateContradictionMarkersFromData({
      messageContent: "I failed and I skipped my workout again this week.",
      activeReferences: [
        {
          id: "ref-1",
          type: "goal",
          statement: "Work out five times per week",
        },
        {
          id: "ref-2",
          type: "goal",
          statement: "Read every evening",
        },
      ],
      existingNodes: [],
    });

    expect(nominations.length).toBeGreaterThan(0);
    for (const nomination of nominations) {
      expect(nomination.kind).toBe("marker_nomination");
      expect(nomination.persistable).toBe(false);
      expect(nomination.quarantineReason).toBe("semantic_adjudication_required");
      // Structural proof: nomination is not a DetectedContradiction shape.
      expect("type" in nomination).toBe(false);
      expect("sideA" in nomination).toBe(false);
      expect("sideB" in nomination).toBe(false);
      expect("confidence" in nomination).toBe(false);
      expect("title" in nomination).toBe(false);
    }

    const asUnknown: unknown = nominations[0];
    const wronglyTreatedAsDetection = asUnknown as DetectedContradiction;
    // Even if cast, materialization requires DetectedContradiction fields that nominations lack.
    expect(wronglyTreatedAsDetection.type).toBeUndefined();
    expect(wronglyTreatedAsDetection.sideA).toBeUndefined();
    expect(wronglyTreatedAsDetection.sideB).toBeUndefined();

    const persistableCheck = (n: ContradictionMarkerNomination) => n.persistable;
    expect(persistableCheck(nominations[0]!)).toBe(false);
  });

  it("does not fan out beyond the nomination cap and never yields DetectedContradiction", () => {
    const nominations = nominateContradictionMarkersFromData({
      messageContent: "but I keep avoiding the hard conversation again today.",
      activeReferences: [
        { id: "c1", type: "constraint", statement: "Speak honestly" },
        { id: "c2", type: "constraint", statement: "Stay calm" },
        { id: "c3", type: "constraint", statement: "Do not seek approval" },
      ],
      existingNodes: [],
    });

    expect(nominations.length).toBeLessThanOrEqual(2);
    expect(detectContradictionsFromData({
      messageContent: "but I keep avoiding the hard conversation again today.",
      activeReferences: [
        { id: "c1", type: "constraint", statement: "Speak honestly" },
        { id: "c2", type: "constraint", statement: "Stay calm" },
        { id: "c3", type: "constraint", statement: "Do not seek approval" },
      ],
      existingNodes: [],
    })).toEqual([]);
  });

  it("records similarExistingNodeId as a duplicate hint only — public path still abstains", () => {
    const nominations = nominateContradictionMarkersFromData({
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

    expect(nominations[0]?.similarExistingNodeId).toBe("node-1");
    expect(nominations[0]?.persistable).toBe(false);
    expect(
      detectContradictionsFromData({
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
      })
    ).toEqual([]);
  });
});

// ── detectContradictions (async DB path) ─────────────────────────────────────
//
// referenceStatuses gate remains: import still passes ["active", "candidate"].
// CEQR-002: even when candidate refs are visible, marker-only logic yields no
// persistable DetectedContradiction.

describe("detectContradictions — referenceStatuses gate + quarantine", () => {
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

  it("abstains even when a candidate reference is included (CEQR-002: no marker-only creation)", async () => {
    // Prior expectation (pre-CEQR-002): returned goal_behavior_gap from marker + ref.
    // Invalid now: markers nominate only; semantic adjudication is not wired.
    prismaMock.referenceItem.findMany.mockResolvedValue([
      { id: "ref-1", type: "goal", statement: "I want to exercise five times a week" },
    ]);

    const detections = await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week — skipped every session.",
      referenceStatuses: ["active", "candidate"],
    });

    expect(detections).toEqual([]);
  });

  it("returns empty when only candidate references exist but default statuses used", async () => {
    prismaMock.referenceItem.findMany.mockResolvedValue([]);

    const detections = await detectContradictions({
      userId: "u1",
      messageContent: "I failed to exercise this week — skipped every session.",
    });

    expect(detections).toEqual([]);
  });
});
