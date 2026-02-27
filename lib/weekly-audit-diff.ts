export type Top3MovementStatus = "entered" | "exited" | "moved" | "unchanged";

export type Top3Movement = {
  id: string;
  status: Top3MovementStatus;
  fromRank: number | null;
  toRank: number | null;
};

export type WeeklyAuditDiffResult = {
  activeReferenceCountDelta: number;
  openContradictionCountDelta: number;
  totalContradictionCountDelta: number;
  top3AvgComputedWeightDelta: number;
  contradictionDensityDelta: number;
  stabilityProxyDelta: number;
  totalAvoidanceDelta: number;
  totalSnoozeDelta: number;
  top3Movement: Top3Movement[];
};

export type AuditDiffInput = {
  activeReferenceCount: number;
  openContradictionCount: number;
  totalContradictionCount: number;
  top3AvgComputedWeight: number;
  totalAvoidanceCount: number;
  totalSnoozeCount: number;
  contradictionDensity: number;
  stabilityProxy: number;
  top3Ids: string[];
};

export function computeWeeklyAuditDiff(
  from: AuditDiffInput,
  to: AuditDiffInput
): WeeklyAuditDiffResult {
  const fromIds = from.top3Ids.slice(0, 3);
  const toIds = to.top3Ids.slice(0, 3);
  const allIds = Array.from(new Set([...fromIds, ...toIds]));

  const top3Movement: Top3Movement[] = allIds.map((id) => {
    const fi = fromIds.indexOf(id);
    const ti = toIds.indexOf(id);

    if (fi === -1) return { id, status: "entered", fromRank: null, toRank: ti + 1 };
    if (ti === -1) return { id, status: "exited", fromRank: fi + 1, toRank: null };
    if (fi !== ti) return { id, status: "moved", fromRank: fi + 1, toRank: ti + 1 };
    return { id, status: "unchanged", fromRank: fi + 1, toRank: ti + 1 };
  });

  return {
    activeReferenceCountDelta: to.activeReferenceCount - from.activeReferenceCount,
    openContradictionCountDelta: to.openContradictionCount - from.openContradictionCount,
    totalContradictionCountDelta: to.totalContradictionCount - from.totalContradictionCount,
    top3AvgComputedWeightDelta: to.top3AvgComputedWeight - from.top3AvgComputedWeight,
    contradictionDensityDelta: to.contradictionDensity - from.contradictionDensity,
    stabilityProxyDelta: to.stabilityProxy - from.stabilityProxy,
    totalAvoidanceDelta: to.totalAvoidanceCount - from.totalAvoidanceCount,
    totalSnoozeDelta: to.totalSnoozeCount - from.totalSnoozeCount,
    top3Movement,
  };
}

export function summarizeWeeklyAuditDiff(diff: WeeklyAuditDiffResult): string[] {
  const bullets: string[] = [];

  if (diff.openContradictionCountDelta !== 0) {
    const n = diff.openContradictionCountDelta;
    bullets.push(
      n > 0
        ? `${n} new open contradiction${n !== 1 ? "s" : ""}`
        : `${Math.abs(n)} open contradiction${Math.abs(n) !== 1 ? "s" : ""} resolved`
    );
  }

  if (Math.abs(diff.contradictionDensityDelta) >= 0.001) {
    const dir = diff.contradictionDensityDelta > 0 ? "increased" : "decreased";
    bullets.push(
      `Contradiction density ${dir} by ${Math.abs(diff.contradictionDensityDelta).toFixed(3)}`
    );
  }

  if (Math.abs(diff.stabilityProxyDelta) >= 0.001) {
    const dir = diff.stabilityProxyDelta > 0 ? "improved" : "worsened";
    bullets.push(`Stability ${dir} by ${Math.abs(diff.stabilityProxyDelta).toFixed(3)}`);
  }

  if (diff.totalAvoidanceDelta !== 0) {
    const n = diff.totalAvoidanceDelta;
    bullets.push(
      n > 0
        ? `${n} more avoidance event${n !== 1 ? "s" : ""}`
        : `${Math.abs(n)} fewer avoidance event${Math.abs(n) !== 1 ? "s" : ""}`
    );
  }

  if (diff.totalSnoozeDelta !== 0) {
    const n = diff.totalSnoozeDelta;
    bullets.push(
      n > 0
        ? `${n} more snooze event${n !== 1 ? "s" : ""}`
        : `${Math.abs(n)} fewer snooze event${Math.abs(n) !== 1 ? "s" : ""}`
    );
  }

  if (diff.activeReferenceCountDelta !== 0) {
    const n = diff.activeReferenceCountDelta;
    bullets.push(
      n > 0
        ? `${n} more active reference${n !== 1 ? "s" : ""}`
        : `${Math.abs(n)} fewer active reference${Math.abs(n) !== 1 ? "s" : ""}`
    );
  }

  const entered = diff.top3Movement.filter((m) => m.status === "entered").length;
  const exited = diff.top3Movement.filter((m) => m.status === "exited").length;
  if (entered > 0) {
    bullets.push(`${entered} contradiction${entered !== 1 ? "s" : ""} entered top-3`);
  }
  if (exited > 0) {
    bullets.push(`${exited} contradiction${exited !== 1 ? "s" : ""} exited top-3`);
  }

  if (bullets.length === 0) {
    bullets.push("No significant changes between these two weeks");
  }

  return bullets;
}
