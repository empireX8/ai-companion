import type { WeeklyAudit } from "@prisma/client";

export type WeeklyAuditDelta = {
  weekStart: string;
  deltaActiveReferenceCount: number;
  deltaOpenContradictionCount: number;
  deltaTotalContradictionCount: number;
  deltaTop3AvgComputedWeight: number;
  deltaTotalAvoidanceCount: number;
  deltaTotalSnoozeCount: number;
  deltaContradictionDensity: number;
  deltaStabilityProxy: number;
};

export function computeWeeklyAuditDeltas(items: WeeklyAudit[]): WeeklyAuditDelta[] {
  const deltas: WeeklyAuditDelta[] = [];

  for (let index = 0; index < items.length - 1; index += 1) {
    const current = items[index];
    const previous = items[index + 1];

    deltas.push({
      weekStart: current.weekStart.toISOString(),
      deltaActiveReferenceCount:
        current.activeReferenceCount - previous.activeReferenceCount,
      deltaOpenContradictionCount:
        current.openContradictionCount - previous.openContradictionCount,
      deltaTotalContradictionCount:
        current.totalContradictionCount - previous.totalContradictionCount,
      deltaTop3AvgComputedWeight:
        current.top3AvgComputedWeight - previous.top3AvgComputedWeight,
      deltaTotalAvoidanceCount:
        current.totalAvoidanceCount - previous.totalAvoidanceCount,
      deltaTotalSnoozeCount: current.totalSnoozeCount - previous.totalSnoozeCount,
      deltaContradictionDensity:
        current.contradictionDensity - previous.contradictionDensity,
      deltaStabilityProxy: current.stabilityProxy - previous.stabilityProxy,
    });
  }

  return deltas;
}
