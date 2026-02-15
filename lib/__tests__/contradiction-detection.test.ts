import { describe, expect, it } from "vitest";

import { detectContradictionsFromData } from "../contradiction-detection";

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
