import type { WeeklyAudit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeWeeklyAuditDeltas } from "../weekly-audit-trend";

describe("computeWeeklyAuditDeltas", () => {
  it("computes week-over-week deltas for descending weekly audits", () => {
    const items: WeeklyAudit[] = [
      {
        id: "w1",
        userId: "user-1",
        weekStart: new Date("2026-02-16T00:00:00.000Z"),
        generatedAt: new Date("2026-02-16T12:00:00.000Z"),
        activeReferenceCount: 10,
        openContradictionCount: 4,
        totalContradictionCount: 8,
        top3AvgComputedWeight: 12,
        top3Ids: ["a", "b", "c"],
        totalAvoidanceCount: 9,
        totalSnoozeCount: 6,
        contradictionDensity: 0.36,
        stabilityProxy: 0.73,
        top3Snapshot: null,
      },
      {
        id: "w2",
        userId: "user-1",
        weekStart: new Date("2026-02-09T00:00:00.000Z"),
        generatedAt: new Date("2026-02-09T12:00:00.000Z"),
        activeReferenceCount: 8,
        openContradictionCount: 5,
        totalContradictionCount: 7,
        top3AvgComputedWeight: 10,
        top3Ids: ["d", "e"],
        totalAvoidanceCount: 7,
        totalSnoozeCount: 5,
        contradictionDensity: 0.56,
        stabilityProxy: 0.64,
        top3Snapshot: null,
      },
      {
        id: "w3",
        userId: "user-1",
        weekStart: new Date("2026-02-02T00:00:00.000Z"),
        generatedAt: new Date("2026-02-02T12:00:00.000Z"),
        activeReferenceCount: 7,
        openContradictionCount: 3,
        totalContradictionCount: 6,
        top3AvgComputedWeight: 9,
        top3Ids: ["f"],
        totalAvoidanceCount: 6,
        totalSnoozeCount: 4,
        contradictionDensity: 0.38,
        stabilityProxy: 0.72,
        top3Snapshot: null,
      },
    ];

    const deltas = computeWeeklyAuditDeltas(items);

    expect(deltas).toHaveLength(2);
    expect(deltas[0]).toMatchObject({
      weekStart: "2026-02-16T00:00:00.000Z",
      deltaActiveReferenceCount: 2,
      deltaOpenContradictionCount: -1,
      deltaTotalContradictionCount: 1,
      deltaTop3AvgComputedWeight: 2,
      deltaTotalAvoidanceCount: 2,
      deltaTotalSnoozeCount: 1,
    });
    expect(deltas[0].deltaContradictionDensity).toBeCloseTo(-0.2);
    expect(deltas[0].deltaStabilityProxy).toBeCloseTo(0.09);
    expect(deltas[1]).toMatchObject({
      weekStart: "2026-02-09T00:00:00.000Z",
      deltaActiveReferenceCount: 1,
      deltaOpenContradictionCount: 2,
      deltaTotalContradictionCount: 1,
      deltaTop3AvgComputedWeight: 1,
      deltaTotalAvoidanceCount: 1,
      deltaTotalSnoozeCount: 1,
    });
    expect(deltas[1].deltaContradictionDensity).toBeCloseTo(0.18);
    expect(deltas[1].deltaStabilityProxy).toBeCloseTo(-0.08);
  });
});
