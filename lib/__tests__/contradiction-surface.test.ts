import { describe, expect, it, vi } from "vitest";

import { getTop3WithOptionalSurfacing } from "../contradiction-surface";
import type { ContradictionSurfaceDb } from "../contradiction-surface";

describe("getTop3WithOptionalSurfacing", () => {
  it("selects top 3 in read_only mode and applies no side effects", async () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const transactionMock = vi.fn();
    const db = {
      contradictionNode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a",
            title: "A",
            sideA: "goal-a",
            sideB: "I skipped again",
            type: "goal_behavior_gap",
            confidence: "medium",
            status: "open",
            recommendedRung: "rung2_explicit_contradiction",
            snoozeCount: 3,
            avoidanceCount: 1,
            evidenceCount: 6,
            timesSurfaced: 5,
            escalationLevel: 2,
            lastEscalatedAt: new Date("2026-02-10T00:00:00.000Z"),
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "b",
            title: "B",
            sideA: "goal-b",
            sideB: "I failed once",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "snoozed",
            recommendedRung: null,
            snoozeCount: 1,
            avoidanceCount: 0,
            evidenceCount: 1,
            timesSurfaced: 0,
            escalationLevel: 0,
            lastEscalatedAt: null,
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: new Date("2026-02-20T00:00:00.000Z"),
          },
          {
            id: "c",
            title: "C",
            sideA: "goal-c",
            sideB: "I procrastinated",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "open",
            recommendedRung: null,
            snoozeCount: 0,
            avoidanceCount: 0,
            evidenceCount: 2,
            timesSurfaced: 0,
            escalationLevel: 0,
            lastEscalatedAt: null,
            lastEvidenceAt: new Date("2026-02-12T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "d",
            title: "D",
            sideA: "goal-d",
            sideB: "I avoided work",
            type: "goal_behavior_gap",
            confidence: "medium",
            status: "explored",
            recommendedRung: "rung1_gentle_mirror",
            snoozeCount: 0,
            avoidanceCount: 0,
            evidenceCount: 1,
            timesSurfaced: 0,
            escalationLevel: 0,
            lastEscalatedAt: null,
            lastEvidenceAt: new Date("2026-02-13T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "e",
            title: "E",
            sideA: "goal-e",
            sideB: "resolved contradiction",
            type: "goal_behavior_gap",
            confidence: "high",
            status: "resolved",
            recommendedRung: "rung5_structured_probe_offer",
            snoozeCount: 10,
            avoidanceCount: 10,
            evidenceCount: 20,
            timesSurfaced: 12,
            escalationLevel: 4,
            lastEscalatedAt: null,
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
        ]),
      },
      $transaction: transactionMock,
    };

    const result = await getTop3WithOptionalSurfacing({
      userId: "user-1",
      mode: "read_only",
      now,
      db: db as unknown as ContradictionSurfaceDb,
    });

    expect(result.items.map((item) => item.id)).toEqual(["a", "c", "d"]);
    expect(result.surfacedIds).toEqual([]);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("applies recorded mode side effects and preserves top ordering", async () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    const updateMock = vi.fn().mockResolvedValue({});
    const db = {
      contradictionNode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "a",
            title: "A",
            sideA: "goal-a",
            sideB: "I skipped again",
            type: "goal_behavior_gap",
            confidence: "medium",
            status: "open",
            recommendedRung: "rung2_explicit_contradiction",
            snoozeCount: 2,
            avoidanceCount: 0,
            evidenceCount: 6,
            timesSurfaced: 5,
            escalationLevel: 2,
            lastEscalatedAt: new Date("2026-02-10T00:00:00.000Z"),
            lastEvidenceAt: new Date("2026-02-14T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "b",
            title: "B",
            sideA: "goal-b",
            sideB: "I failed",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "open",
            recommendedRung: "rung4_forced_choice_framing",
            snoozeCount: 0,
            avoidanceCount: 0,
            evidenceCount: 2,
            timesSurfaced: 9,
            escalationLevel: 4,
            lastEscalatedAt: new Date("2026-02-14T00:00:00.000Z"),
            lastEvidenceAt: new Date("2026-02-13T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-14T00:00:00.000Z"),
            snoozedUntil: null,
          },
          {
            id: "c",
            title: "C",
            sideA: "goal-c",
            sideB: "I procrastinated",
            type: "goal_behavior_gap",
            confidence: "low",
            status: "explored",
            recommendedRung: "rung1_gentle_mirror",
            snoozeCount: 0,
            avoidanceCount: 0,
            evidenceCount: 1,
            timesSurfaced: 0,
            escalationLevel: 0,
            lastEscalatedAt: null,
            lastEvidenceAt: new Date("2026-02-13T00:00:00.000Z"),
            lastTouchedAt: new Date("2026-02-15T00:00:00.000Z"),
            snoozedUntil: null,
          },
        ]),
        update: updateMock,
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          contradictionNode: {
            update: updateMock,
          },
        })
      ),
    };

    const result = await getTop3WithOptionalSurfacing({
      userId: "user-1",
      mode: "recorded",
      now,
      db: db as unknown as ContradictionSurfaceDb,
    });

    expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.surfacedIds).toEqual(["a", "b", "c"]);

    const calls = updateMock.mock.calls.map((call) => call[0]);
    const weightUpdates = calls.filter(
      (call) =>
        typeof call?.data?.weight === "number" &&
        call?.data?.timesSurfaced === undefined
    );
    const surfacedUpdates = calls.filter(
      (call) => call?.data?.timesSurfaced?.increment === 1
    );

    expect(weightUpdates).toHaveLength(3);
    expect(surfacedUpdates).toHaveLength(3);

    const updateA = surfacedUpdates.find((call) => call.where.id === "a");
    const updateB = surfacedUpdates.find((call) => call.where.id === "b");

    expect(updateA?.data.lastEscalatedAt).toEqual(now);
    expect(updateA?.data.escalationLevel).toBe(3);
    expect(updateA?.data.recommendedRung).toBe("rung4_forced_choice_framing");

    expect(updateB?.data.lastEscalatedAt).toBeUndefined();
    expect(updateB?.data.escalationLevel).toBe(4);
    expect(updateB?.data.recommendedRung).toBe("rung5_structured_probe_offer");
  });
});
