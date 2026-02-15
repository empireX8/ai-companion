import { describe, expect, it, vi } from "vitest";

import { buildWeeklyAudit, getWeekStart } from "../weekly-audit";

describe("getWeekStart", () => {
  it("returns Monday 00:00:00 UTC for an in-week date", () => {
    const date = new Date("2026-02-18T15:30:00.000Z"); // Wednesday
    const weekStart = getWeekStart(date);

    expect(weekStart.toISOString()).toBe("2026-02-16T00:00:00.000Z");
  });
});

describe("buildWeeklyAudit", () => {
  it("computes contradictionDensity and stabilityProxy from counts", async () => {
    const count = vi.fn().mockImplementation(async (args: { where: unknown }) => {
      const where = args.where as { status?: { in: string[] } };
      if (where?.status && "in" in where.status) {
        return 4;
      }
      return 8;
    });

    const db = {
      referenceItem: {
        count: vi.fn().mockResolvedValue(3),
      },
      contradictionNode: {
        count,
        aggregate: vi.fn().mockResolvedValue({
          _sum: { avoidanceCount: 5, snoozeCount: 7 },
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const audit = await buildWeeklyAudit("user-1", new Date("2026-02-18T10:00:00.000Z"), db);

    expect(audit.openContradictionCount).toBe(4);
    expect(audit.activeReferenceCount).toBe(3);
    expect(audit.contradictionDensity).toBe(1);
    expect(audit.stabilityProxy).toBe(0.5);
    expect(audit.totalAvoidanceCount).toBe(5);
    expect(audit.totalSnoozeCount).toBe(7);
  });

  it("truncates top3 snapshot fields to expected max lengths", async () => {
    const longTitle = "t".repeat(220);
    const longSide = "a".repeat(300);

    const db = {
      referenceItem: {
        count: vi.fn().mockResolvedValue(0),
      },
      contradictionNode: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { avoidanceCount: 0, snoozeCount: 0 },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "node-1",
            title: longTitle,
            sideA: longSide,
            sideB: longSide,
            type: "goal_behavior_gap",
            confidence: "low",
            status: "open",
            weight: 0,
            snoozeCount: 0,
            evidenceCount: 0,
            recommendedRung: "rung1_gentle_mirror",
            lastEvidenceAt: null,
            lastTouchedAt: new Date("2026-02-18T00:00:00.000Z"),
            snoozedUntil: null,
          },
        ]),
      },
    };

    const audit = await buildWeeklyAudit("user-1", new Date("2026-02-18T10:00:00.000Z"), db);
    const snapshotItem = audit.top3Snapshot[0];

    expect(snapshotItem.title.length).toBeLessThanOrEqual(180);
    expect(snapshotItem.sideA.length).toBeLessThanOrEqual(240);
    expect(snapshotItem.sideB.length).toBeLessThanOrEqual(240);
  });
});
