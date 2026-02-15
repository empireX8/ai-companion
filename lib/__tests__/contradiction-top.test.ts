import { describe, expect, it, vi } from "vitest";

import { getTopContradictions } from "../contradiction-top";

describe("getTopContradictions", () => {
  it("excludes snoozed nodes with future snoozedUntil, orders by salience, and returns max 3", async () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const db = {
      contradictionNode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a",
            title: "A",
            sideA: "goal-a",
            sideB: "i failed again",
            type: "goal_behavior_gap",
            confidence: "medium",
            status: "open",
            weight: 0,
            snoozeCount: 4,
            evidenceCount: 8,
            recommendedRung: "rung2_explicit_contradiction",
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "b",
            title: "B",
            sideA: "constraint-b",
            sideB: "but I did it",
            type: "constraint_conflict",
            confidence: "low",
            status: "snoozed",
            weight: 0,
            snoozeCount: 10,
            evidenceCount: 10,
            recommendedRung: "rung3_evidence_pressure",
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: new Date("2026-02-20T00:00:00.000Z"),
          },
          {
            id: "c",
            title: "C",
            sideA: "goal-c",
            sideB: "i skipped",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "open",
            weight: 0,
            snoozeCount: 2,
            evidenceCount: 2,
            recommendedRung: null,
            lastEvidenceAt: new Date("2026-02-13T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "d",
            title: "D",
            sideA: "goal-d",
            sideB: "i avoided",
            type: "goal_behavior_gap",
            confidence: "medium",
            status: "explored",
            weight: 0,
            snoozeCount: 1,
            evidenceCount: 1,
            recommendedRung: "rung1_gentle_mirror",
            lastEvidenceAt: new Date("2026-02-12T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "e",
            title: "E",
            sideA: "goal-e",
            sideB: "i procrastinated",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "open",
            weight: 0,
            snoozeCount: 0,
            evidenceCount: 0,
            recommendedRung: null,
            lastEvidenceAt: null,
            lastTouchedAt: new Date("2026-02-10T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "f",
            title: "F",
            sideA: "goal-f",
            sideB: "i failed repeatedly",
            type: "goal_behavior_gap",
            confidence: "high",
            status: "resolved",
            weight: 0,
            snoozeCount: 50,
            evidenceCount: 20,
            recommendedRung: "rung5_structured_probe_offer",
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
        ]),
      },
    };

    const result = await getTopContradictions("user-1", now, db);

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual(["a", "c", "d"]);
    expect(result.some((item) => item.id === "b")).toBe(false);
    expect(result.some((item) => item.id === "f")).toBe(false);
  });
});
